import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview, InterviewStatus } from '../entities/interview.entity';
import {
  InterviewMessage,
  MessageRole,
} from '../entities/interview-message.entity';
import { LangChainService } from '../../ai/langchain.service';
import { PromptService, PromptFeature } from '../../ai/prompt.service';
import { PromptInjectionService } from './prompt-injection.service';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { SendMessageDto } from '../dto/send-message.dto';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewMessage)
    private readonly messageRepo: Repository<InterviewMessage>,
    private readonly langChainService: LangChainService,
    private readonly promptService: PromptService,
    private readonly promptInjectionService: PromptInjectionService,
  ) {}

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Appends the user's current code to their message so the AI has full context.
   * Used by both chat and voice turns. The original content is saved to DB;
   * this enriched version is only sent to the LLM.
   */
  private buildUserContent(
    content: string,
    snapshot: { latestCode?: string; codeLanguage?: string } | null,
  ): string {
    const code = snapshot?.latestCode || '';
    const language = snapshot?.codeLanguage || 'unknown';
    if (code.trim().length > 0) {
      return (
        content +
        `\n\n[USER CURRENT CODE (${language})]:\n\`\`\`${language}\n${code}\n\`\`\`\n(Please review and reference this code in your response if relevant)`
      );
    }
    return content + `\n\n[Note: User has not written any code yet]`;
  }

  /**
   * Returns the language-specific feature name, falling back to the base feature
   * for English or when a localized prompt config doesn't exist.
   */
  private getPromptFeatureName(
    baseFeature: PromptFeature,
    language: string,
  ): string {
    if (!language || language === 'en') return baseFeature;
    return `${baseFeature}-${language}`;
  }

  private static readonly LANGUAGE_DIRECTIVES: Record<string, string> = {
    vi: 'IMPORTANT: You MUST respond entirely in Vietnamese (Tiếng Việt). All your responses, questions, hints, and feedback must be in Vietnamese. Do NOT use English.',
  };

  /**
   * Builds the system prompt. Voice turns include the voice-adaptation addendum.
   * Loads language-specific prompts when available, falling back to English.
   * Appends a language directive for non-English interviews to guarantee the
   * LLM responds in the correct language even when the base prompt is English.
   */
  private async buildSystemPrompt(
    interview: Interview,
    channel: 'chat' | 'voice',
  ): Promise<string> {
    const language = interview.language || 'en';
    const interviewerFeature = this.getPromptFeatureName(
      PromptFeature.INTERVIEWER,
      language,
    );
    const voiceFeature = this.getPromptFeatureName(
      PromptFeature.VOICE_ADAPTATION,
      language,
    );

    const problemContext = JSON.stringify(interview.problemSnapshot);

    // Fetch customization variables from Langfuse
    const customizationVars =
      await this.promptInjectionService.getPromptVariables(
        interview.mode,
        interview.difficulty,
        interview.personality,
      );

    const prompts = await Promise.all([
      this.promptService
        .getCompiledPrompt(interviewerFeature, {
          problemContext,
          ...customizationVars,
        })
        .catch(() =>
          this.promptService.getCompiledPrompt(PromptFeature.INTERVIEWER, {
            problemContext,
            ...customizationVars,
          }),
        ),
      channel === 'voice'
        ? this.promptService
            .getCompiledPrompt(voiceFeature, {})
            .catch(() =>
              this.promptService
                .getCompiledPrompt(PromptFeature.VOICE_ADAPTATION, {})
                .catch(() => ''),
            )
        : Promise.resolve(''),
    ]);

    const parts = prompts.filter(Boolean);

    const directive = AiChatService.LANGUAGE_DIRECTIVES[language];
    if (directive) {
      parts.push(directive);
    }

    return parts.join('\n\n');
  }

  /**
   * Converts saved DB messages into LangChain message objects,
   * skipping the message just saved (which is passed directly to chat()).
   */
  private buildLangChainHistory(
    systemPrompt: string,
    history: InterviewMessage[],
    excludeId: string,
  ): BaseMessage[] {
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)];
    for (const msg of history) {
      if (msg.id === excludeId) continue;
      messages.push(
        msg.role === MessageRole.ASSISTANT
          ? new AIMessage(msg.content)
          : new HumanMessage(msg.content),
      );
    }
    return messages;
  }

  // ─── Public Methods ──────────────────────────────────────────────────────────

  async sendMessage(interviewId: string, userId: number, dto: SendMessageDto) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId, userId },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.status !== InterviewStatus.ACTIVE)
      throw new BadRequestException('Interview is not active');

    // Prefer code from request; fall back to stored snapshot
    const snapshot = dto.code
      ? {
          ...interview.problemSnapshot,
          latestCode: dto.code,
          codeLanguage: dto.language,
        }
      : interview.problemSnapshot;

    const userContent = this.buildUserContent(dto.content, snapshot);

    // Save original message (no code appended) for clean history
    const userMsg = await this.messageRepo.save(
      this.messageRepo.create({
        interviewId,
        role: MessageRole.USER,
        content: dto.content,
      }),
    );

    // Persist code snapshot when provided
    if (dto.code) {
      interview.problemSnapshot = {
        ...interview.problemSnapshot,
        latestCode: dto.code,
        codeLanguage: dto.language,
        codeUpdatedAt: Date.now(),
      };
      await this.interviewRepo.save(interview);
    }

    const history = await this.messageRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });
    const systemPrompt = await this.buildSystemPrompt(interview, 'chat');
    const langChainHistory = this.buildLangChainHistory(
      systemPrompt,
      history,
      userMsg.id,
    );

    let aiText = "I'm sorry, I couldn't generate a response.";
    try {
      aiText = await this.langChainService.chat(langChainHistory, userContent, {
        threadId: `interview-${interviewId}`,
        runName: 'interview-chat',
        metadata: { userId, problemId: interview.problemId },
      });
    } catch (error) {
      console.error('LangChain Chat Error:', error);
    }

    const aiMsg = await this.messageRepo.save(
      this.messageRepo.create({
        interviewId,
        role: MessageRole.ASSISTANT,
        content: aiText,
      }),
    );
    return aiMsg;
  }

  async processVoiceMessage(interviewId: string, content: string) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.status !== InterviewStatus.ACTIVE)
      throw new BadRequestException('Interview is not active');

    const userContent = this.buildUserContent(
      content,
      interview.problemSnapshot,
    );

    // Store original transcript without code for clean history
    const userMsg = await this.messageRepo.save(
      this.messageRepo.create({ interviewId, role: MessageRole.USER, content }),
    );

    const history = await this.messageRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });
    const systemPrompt = await this.buildSystemPrompt(interview, 'voice');
    const langChainHistory = this.buildLangChainHistory(
      systemPrompt,
      history,
      userMsg.id,
    );

    let aiText = "I'm sorry, I couldn't generate a response.";
    try {
      aiText = await this.langChainService.chat(langChainHistory, userContent, {
        threadId: `interview-${interviewId}`,
        runName: 'interview-voice',
        metadata: { channel: 'voice' },
      });
    } catch (error) {
      console.error('LangChain Voice Chat Error:', error);
    }

    await this.messageRepo.save(
      this.messageRepo.create({
        interviewId,
        role: MessageRole.ASSISTANT,
        content: aiText,
      }),
    );
    return { content: aiText };
  }

  async *streamVoiceMessage(
    interviewId: string,
    content: string,
  ): AsyncGenerator<string> {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.status !== InterviewStatus.ACTIVE)
      throw new BadRequestException('Interview is not active');

    const userContent = this.buildUserContent(
      content,
      interview.problemSnapshot,
    );

    // Store original transcript without code for clean history
    const userMsg = await this.messageRepo.save(
      this.messageRepo.create({ interviewId, role: MessageRole.USER, content }),
    );

    const history = await this.messageRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });
    const systemPrompt = await this.buildSystemPrompt(interview, 'voice');
    const langChainHistory = this.buildLangChainHistory(
      systemPrompt,
      history,
      userMsg.id,
    );

    let fullText = '';
    try {
      for await (const token of this.langChainService.streamChat(
        langChainHistory,
        userContent,
        {
          threadId: `interview-${interviewId}`,
          runName: 'interview-voice',
          metadata: { channel: 'voice' },
        },
      )) {
        fullText += token;
        yield token;
      }
    } catch (error) {
      console.error('LangChain Voice Stream Error:', error);
      if (!fullText) {
        const fallback = "I'm sorry, I couldn't generate a response.";
        yield fallback;
        fullText = fallback;
      }
    }

    await this.messageRepo.save(
      this.messageRepo.create({
        interviewId,
        role: MessageRole.ASSISTANT,
        content: fullText || "I'm sorry, I couldn't generate a response.",
      }),
    );
  }

  private getGreetingInstruction(language: string): string {
    if (language === 'vi') {
      return 'Chào ứng viên một cách thân thiện và hỏi họ đã sẵn sàng bắt đầu phỏng vấn chưa. Giữ ngắn gọn và thân thiện — một hoặc hai câu. KHÔNG đề cập đến bài toán. Trả lời hoàn toàn bằng tiếng Việt.';
    }
    return 'Generate a warm greeting for the candidate. Ask if they are ready to begin. Keep it brief and friendly — one or two sentences. Do NOT mention the problem yet.';
  }

  private getGreetingFallback(language: string): string {
    if (language === 'vi') {
      return 'Xin chào! Chào mừng bạn đến với buổi phỏng vấn lập trình. Bạn đã sẵn sàng chưa?';
    }
    return 'Hello! Welcome to your coding interview. Are you ready to begin?';
  }

  async generateGreeting(interviewId: string) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    const hasUserMessages = await this.messageRepo.existsBy({
      interviewId,
      role: MessageRole.USER,
    });

    if (hasUserMessages) {
      return { content: '' };
    }

    const language = interview.language || 'en';
    const systemPrompt = await this.buildSystemPrompt(interview, 'voice');
    let aiText = this.getGreetingFallback(language);
    try {
      aiText = await this.langChainService.chat(
        [new SystemMessage(systemPrompt)],
        this.getGreetingInstruction(language),
        {
          threadId: `interview-${interviewId}`,
          runName: 'interview-greeting',
          metadata: { channel: 'voice', language },
        },
      );
    } catch (error) {
      console.error('LangChain Greeting Error:', error);
    }
    return { content: aiText };
  }

  async getHistory(interviewId: string, userId: number) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId, userId },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    return this.messageRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });
  }
}

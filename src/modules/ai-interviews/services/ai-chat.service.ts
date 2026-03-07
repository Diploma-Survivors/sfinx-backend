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
   * Builds the system prompt. Voice turns include the voice-adaptation addendum.
   */
  private async buildSystemPrompt(
    interview: Interview,
    channel: 'chat' | 'voice',
  ): Promise<string> {
    const problemContext = JSON.stringify(interview.problemSnapshot);
    const prompts = await Promise.all([
      this.promptService.getCompiledPrompt(PromptFeature.INTERVIEWER, {
        problemContext,
      }),
      channel === 'voice'
        ? this.promptService.getCompiledPrompt(
            PromptFeature.VOICE_ADAPTATION,
            {},
          )
        : Promise.resolve(''),
    ]);
    return prompts.filter(Boolean).join('\n\n');
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
        threadId: interviewId,
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
        threadId: interviewId,
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
          threadId: interviewId,
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

  async generateGreeting(interviewId: string) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    const systemPrompt = await this.buildSystemPrompt(interview, 'voice');

    let aiText =
      'Hello! Welcome to your coding interview. Are you ready to begin?';
    try {
      aiText = await this.langChainService.chat(
        [new SystemMessage(systemPrompt)],
        'Generate a warm greeting for the candidate. Ask if they are ready to begin. Keep it brief and friendly — one or two sentences. Do NOT mention the problem yet.',
        {
          threadId: interviewId,
          runName: 'interview-voice-start',
          metadata: { channel: 'voice' },
        },
      );
    } catch (error) {
      console.error('LangChain Greeting Error:', error);
    }

    const aiMsg = await this.messageRepo.save(
      this.messageRepo.create({
        interviewId,
        role: MessageRole.ASSISTANT,
        content: aiText,
      }),
    );
    return { content: aiMsg.content };
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

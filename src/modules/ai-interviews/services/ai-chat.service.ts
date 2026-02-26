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

  async sendMessage(interviewId: string, userId: number, dto: SendMessageDto) {
    // 1. Validate Interview
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status !== InterviewStatus.ACTIVE) {
      throw new BadRequestException('Interview is not active');
    }

    // 2. Prepare User Content with CODE CONTEXT
    // ALWAYS include code if available - critical for AI to see user's code
    let userContent = dto.content;

    // Get the latest code from the interview snapshot if not provided
    const codeToSend = dto.code || interview.problemSnapshot?.latestCode || '';
    const languageToSend =
      dto.language || interview.problemSnapshot?.codeLanguage || 'unknown';

    if (codeToSend && codeToSend.trim().length > 0) {
      userContent += `\n\n[USER CURRENT CODE (${languageToSend})]:\n\`\`\`${languageToSend}\n${codeToSend}\n\`\`\`\n(Please review and reference this code in your response if relevant)`;
    } else {
      userContent += `\n\n[Note: User has not written any code yet]`;
    }

    // 3. Save User Message (original content without code for cleaner history)
    const userMsg = this.messageRepo.create({
      interviewId,
      role: MessageRole.USER,
      content: dto.content, // Store original message
    });
    await this.messageRepo.save(userMsg);

    // 4. Update interview with latest code snapshot
    if (dto.code) {
      interview.problemSnapshot = {
        ...interview.problemSnapshot,
        latestCode: dto.code,
        codeLanguage: dto.language,
        codeUpdatedAt: Date.now(),
      };
      await this.interviewRepo.save(interview);
    }

    // 5. Build History for Gemini
    const history = await this.messageRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });

    // Build system prompt with problem context
    const problemContext = JSON.stringify(interview.problemSnapshot);
    const systemPrompt = await this.promptService.getCompiledPrompt(
      PromptFeature.INTERVIEWER,
      { problemContext },
    );

    const langChainHistory: BaseMessage[] = [new SystemMessage(systemPrompt)];

    // Add conversation history (exclude current message — it's passed separately to chat())
    for (const msg of history) {
      if (msg.id === userMsg.id) continue;
      if (msg.role === MessageRole.ASSISTANT) {
        langChainHistory.push(new AIMessage(msg.content));
      } else {
        langChainHistory.push(new HumanMessage(msg.content));
      }
    }

    // 6. Send to LangChain (with LangSmith tracing)
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

    // 7. Save AI Message
    const aiMsg = this.messageRepo.create({
      interviewId,
      role: MessageRole.ASSISTANT,
      content: aiText,
    });
    await this.messageRepo.save(aiMsg);

    return aiMsg;
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

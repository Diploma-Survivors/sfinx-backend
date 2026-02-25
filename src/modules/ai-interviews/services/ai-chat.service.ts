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
import { GeminiService } from './gemini.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { SystemPromptInterviewer } from '../constants/prompts';
import { format } from 'node:util';
import { Content } from '@google/generative-ai';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewMessage)
    private readonly messageRepo: Repository<InterviewMessage>,
    private readonly geminiService: GeminiService,
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
    const languageToSend = dto.language || interview.problemSnapshot?.codeLanguage || 'unknown';
    
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
    const systemPrompt = format(SystemPromptInterviewer, problemContext);

    const geminiHistory: Content[] = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I am ready to conduct the interview.' }],
      },
    ];

    // Add conversation history
    for (const msg of history) {
      if (msg.id === userMsg.id) {
        // For current message, use the version WITH code context
        geminiHistory.push({
          role: 'user',
          parts: [{ text: userContent }],
        });
      } else {
        geminiHistory.push({
          role: msg.role === MessageRole.ASSISTANT ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // 6. Send to Gemini with streaming
    const chatSession = this.geminiService.startChat(geminiHistory);
    let aiText = "I'm sorry, I couldn't generate a response.";
    
    try {
      const result = await chatSession.sendMessage(userContent);
      aiText = result.response.text();
    } catch (error) {
      console.error('Gemini Chat Error:', error);
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

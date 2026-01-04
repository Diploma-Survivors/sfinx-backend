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

    // 2. Prepare User Content
    let userContent = dto.content;
    if (dto.code) {
      const lang = dto.language || 'unknown';
      userContent += `\n\n[USER ATTACHED CODE (${lang})]:\n\`\`\`${lang}\n${dto.code}\n\`\`\`\n(Please review this code as part of the interview context)`;
    }

    // 3. Save User Message
    const userMsg = this.messageRepo.create({
      interviewId,
      role: MessageRole.USER,
      content: userContent,
    });
    await this.messageRepo.save(userMsg);

    // 4. Build History for Gemini
    const history = await this.messageRepo.find({
      where: { interviewId },
      order: { createdAt: 'ASC' },
    });

    // System Instruction as Fake Turn
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

    // Add Real History
    for (const msg of history) {
      if (msg.id === userMsg.id) continue; // Skip current message

      geminiHistory.push({
        role: msg.role === MessageRole.ASSISTANT ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // 5. Send to Gemini
    const chatSession = this.geminiService.startChat(geminiHistory);
    let aiText = "I'm sorry, I couldn't generate a response.";
    try {
      const result = await chatSession.sendMessage(userContent);
      aiText = result.response.text();
    } catch (error) {
      console.error('Gemini Chat Error:', error);
    }

    // 6. Save AI Message
    const aiMsg = this.messageRepo.create({
      interviewId,
      role: MessageRole.ASSISTANT,
      content: aiText,
    });
    await this.messageRepo.save(aiMsg);

    return {
      messageId: aiMsg.id,
      aiResponse: aiText,
    };
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

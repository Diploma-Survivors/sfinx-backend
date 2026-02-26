import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from '../entities/interview.entity';
import {
  InterviewMessage,
  MessageRole,
} from '../entities/interview-message.entity';
import { PromptService, PromptFeature } from '../../ai/prompt.service';

interface StoreTranscriptDto {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

@ApiTags('AI Interviews - Internal')
@Controller('internal/ai-interviews')
export class AiInterviewsInternalController {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewMessage)
    private readonly messageRepo: Repository<InterviewMessage>,
    private readonly configService: ConfigService,
    private readonly promptService: PromptService,
  ) {}

  private validateApiKey(apiKey: string | undefined): void {
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('Internal API not configured');
    }

    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  @Get(':id/context')
  @ApiOperation({
    summary: 'Get interview context for voice agent',
    description: 'Internal endpoint for Iris to fetch problem context',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Internal API key' })
  async getContext(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    this.validateApiKey(apiKey);

    const interview = await this.interviewRepo.findOne({
      where: { id },
    });

    if (!interview) {
      return { error: 'Interview not found' };
    }

    const problemContext = JSON.stringify(interview.problemSnapshot, null, 2);
    const systemPrompt = await this.promptService.getCompiledPrompt(
      PromptFeature.INTERVIEWER,
      { problemContext },
    );

    const existingMessages = await this.messageRepo.find({
      where: { interviewId: id },
      order: { createdAt: 'ASC' },
    });

    return {
      interviewId: interview.id,
      userId: interview.userId,
      problemId: interview.problemId,
      problemSnapshot: interview.problemSnapshot as Record<string, unknown>,
      systemPrompt,
      status: interview.status,
      existingMessages: existingMessages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post(':id/transcript')
  @ApiOperation({
    summary: 'Store voice transcript',
    description: 'Internal endpoint for Iris to save conversation messages',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Internal API key' })
  async storeTranscript(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
    @Body() dto: StoreTranscriptDto,
  ) {
    this.validateApiKey(apiKey);

    const interview = await this.interviewRepo.findOne({
      where: { id },
    });

    if (!interview) {
      return { error: 'Interview not found' };
    }

    const message = this.messageRepo.create({
      interviewId: id,
      role: dto.role === 'assistant' ? MessageRole.ASSISTANT : MessageRole.USER,
      content: dto.content,
    });

    await this.messageRepo.save(message);

    return {
      success: true,
      messageId: message.id,
    };
  }

  @Post(':id/transcript/bulk')
  @ApiOperation({
    summary: 'Bulk store voice transcripts',
    description: 'Store multiple messages at once',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Internal API key' })
  async storeTranscriptBulk(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
    @Body() messages: StoreTranscriptDto[],
  ) {
    this.validateApiKey(apiKey);

    const interview = await this.interviewRepo.findOne({
      where: { id },
    });

    if (!interview) {
      return { error: 'Interview not found' };
    }

    const savedMessages = await Promise.all(
      messages.map(async (dto) => {
        const message = this.messageRepo.create({
          interviewId: id,
          role:
            dto.role === 'assistant' ? MessageRole.ASSISTANT : MessageRole.USER,
          content: dto.content,
        });
        return this.messageRepo.save(message);
      }),
    );

    return {
      success: true,
      count: savedMessages.length,
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { AiChatService } from '../services/ai-chat.service';

interface StoreTranscriptDto {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface VoiceMessageDto {
  content: string;
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
    private readonly chatService: AiChatService,
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

    const language = interview.language || 'en';
    const problemContext = JSON.stringify(interview.problemSnapshot, null, 2);

    const interviewerFeature =
      language === 'en'
        ? PromptFeature.INTERVIEWER
        : `${PromptFeature.INTERVIEWER}-${language}`;
    const voiceFeature =
      language === 'en'
        ? PromptFeature.VOICE_ADAPTATION
        : `${PromptFeature.VOICE_ADAPTATION}-${language}`;

    const [systemPrompt, voiceAdaptationPrompt] = await Promise.all([
      this.promptService
        .getCompiledPrompt(interviewerFeature, { problemContext })
        .catch(() =>
          this.promptService.getCompiledPrompt(PromptFeature.INTERVIEWER, {
            problemContext,
          }),
        ),
      this.promptService
        .getCompiledPrompt(voiceFeature, {})
        .catch(() =>
          this.promptService
            .getCompiledPrompt(PromptFeature.VOICE_ADAPTATION, {})
            .catch(() => null),
        ),
    ]);

    const existingMessages = await this.messageRepo.find({
      where: { interviewId: id },
      order: { createdAt: 'ASC' },
    });

    return {
      interviewId: interview.id,
      userId: interview.userId,
      problemId: interview.problemId,
      language,
      problemSnapshot: interview.problemSnapshot as Record<string, unknown>,
      systemPrompt,
      voiceAdaptationPrompt,
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

  @Post(':id/voice-message')
  @ApiOperation({
    summary: 'Process a voice message through LangChain/Gemini',
    description: 'Internal endpoint for Iris to route LLM inference',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Internal API key' })
  async voiceMessage(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
    @Body() dto: VoiceMessageDto,
  ) {
    this.validateApiKey(apiKey);
    return this.chatService.processVoiceMessage(id, dto.content);
  }

  @Post(':id/voice-message/stream')
  @ApiOperation({
    summary: 'Stream voice message response (SSE)',
    description:
      'Internal SSE endpoint for Iris to receive streamed LLM tokens — reduces TTS latency',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Internal API key' })
  async streamVoiceMessage(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
    @Body() dto: VoiceMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    this.validateApiKey(apiKey);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const token of this.chatService.streamVoiceMessage(
        id,
        dto.content,
      )) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    } catch (err) {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ error: (err as Error).message || 'Stream failed' })}\n\n`,
        );
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  @Post(':id/voice-start')
  @ApiOperation({
    summary: 'Generate initial greeting for voice interview',
    description: 'Internal endpoint for Iris to get an opening greeting',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Internal API key' })
  async voiceStart(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    this.validateApiKey(apiKey);
    return this.chatService.generateGreeting(id);
  }
}

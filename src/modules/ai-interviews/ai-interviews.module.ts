import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Interview } from './entities/interview.entity';
import { InterviewMessage } from './entities/interview-message.entity';
import { InterviewEvaluation } from './entities/interview-evaluation.entity';
import { Problem } from '../problems/entities/problem.entity';
import { AiInterviewController } from './controllers/ai-interviews.controller';
import { AiInterviewService } from './services/ai-interview.service';
import { AiChatService } from './services/ai-chat.service';
import { GeminiService } from './services/gemini.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Interview,
      InterviewMessage,
      InterviewEvaluation,
      Problem,
    ]),
    ConfigModule,
  ],
  controllers: [AiInterviewController],
  providers: [AiInterviewService, AiChatService, GeminiService],
  exports: [AiInterviewService],
})
export class AiInterviewsModule {}

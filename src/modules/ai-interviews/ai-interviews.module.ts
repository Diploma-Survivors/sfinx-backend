import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interview } from './entities/interview.entity';
import { InterviewMessage } from './entities/interview-message.entity';
import { InterviewEvaluation } from './entities/interview-evaluation.entity';
import { Problem } from '../problems/entities/problem.entity';
import { AiInterviewController } from './controllers/ai-interviews.controller';
import { AiInterviewsInternalController } from './controllers/ai-interviews-internal.controller';
import { AiInterviewService } from './services/ai-interview.service';
import { AiChatService } from './services/ai-chat.service';
import { PromptInjectionService } from './services/prompt-injection.service';
import { AiModule } from '../ai/ai.module';
import { Judge0Module } from '../judge0/judge0.module';
import { ProgrammingLanguageModule } from '../programming-language/programming-language.module';
import { ProblemsModule } from '../problems/problems.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { InterviewTimeoutModule } from './interview-timeout-queue/interview-timeout.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Interview,
      InterviewMessage,
      InterviewEvaluation,
      Problem,
    ]),
    AiModule,
    Judge0Module,
    ProgrammingLanguageModule,
    ProblemsModule,
    SubmissionsModule,
    InterviewTimeoutModule,
  ],
  controllers: [AiInterviewController, AiInterviewsInternalController],
  providers: [AiInterviewService, AiChatService, PromptInjectionService],
  exports: [AiInterviewService, PromptInjectionService],
})
export class AiInterviewsModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { InterviewTimeoutProcessor } from './interview-timeout.processor';
import { InterviewTimeoutService } from './interview-timeout.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interview } from '../entities/interview.entity';
import { InterviewMessage } from '../entities/interview-message.entity';
import { InterviewEvaluation } from '../entities/interview-evaluation.entity';
import { ProgrammingLanguageModule } from '../../programming-language/programming-language.module';
import { Judge0Module } from '../../judge0/judge0.module';
import { ProblemsModule } from '../../problems/problems.module';
import { SubmissionsModule } from '../../submissions/submissions.module';
import { AiModule } from '../../ai/ai.module';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'interview-timeout',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    TypeOrmModule.forFeature([
      Interview,
      InterviewMessage,
      InterviewEvaluation,
    ]),
    ProgrammingLanguageModule,
    Judge0Module,
    ProblemsModule,
    SubmissionsModule,
    AiModule,
  ],
  providers: [InterviewTimeoutProcessor, InterviewTimeoutService],
  exports: [InterviewTimeoutService],
})
export class InterviewTimeoutModule {}

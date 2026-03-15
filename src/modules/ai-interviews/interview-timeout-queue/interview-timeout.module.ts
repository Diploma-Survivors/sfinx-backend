import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InterviewTimeoutProcessor } from './interview-timeout.processor';
import { InterviewTimeoutService } from './interview-timeout.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interview } from '../entities/interview.entity';
import { InterviewMessage } from '../entities/interview-message.entity';
import { InterviewEvaluation } from '../entities/interview-evaluation.entity';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'interview-timeout',
    }),
    TypeOrmModule.forFeature([
      Interview,
      InterviewMessage,
      InterviewEvaluation,
    ]),
  ],
  providers: [InterviewTimeoutProcessor, InterviewTimeoutService],
  exports: [InterviewTimeoutService],
})
export class InterviewTimeoutModule {}

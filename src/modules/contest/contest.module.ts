import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { Problem } from '../problems/entities/problem.entity';
import { StorageModule } from '../storage/storage.module';
import { Submission } from '../submissions/entities/submission.entity';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ProblemsModule } from '../problems/problems.module';
import { ContestController } from './controllers/contest.controller';
import { ContestLeaderboardController } from './controllers/contest-leaderboard.controller';
import { ContestProblemsController } from './controllers/contest-problems.controller';
import { Contest, ContestParticipant, ContestProblem } from './entities';
import {
  ContestLeaderboardService,
  ContestService,
  ContestSseService,
  ContestSubmissionService,
} from './services';
import { ContestStatisticsService } from './services/contest-statistics.service';
import { ContestSubmissionListener } from './listeners/contest-submission.listener';
import { ContestEventHandlers } from './events/contest.event-handlers';
import { ContestSchedulerProcessor } from './processors/contest-scheduler.processor';
import { CONTEST_QUEUE } from './constants/scheduler.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contest,
      ContestProblem,
      ContestParticipant,
      Problem,
      Submission,
    ]),
    StorageModule,
    forwardRef(() => SubmissionsModule),
    ProblemsModule,
    ScheduleModule,
    BullModule.registerQueueAsync({
      name: CONTEST_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
  ],
  controllers: [
    ContestController,
    ContestProblemsController,
    ContestLeaderboardController,
  ],
  providers: [
    ContestService,
    ContestStatisticsService,
    ContestLeaderboardService,
    ContestSubmissionService,
    ContestSseService,
    ContestSubmissionListener,
    ContestEventHandlers,
    ContestSchedulerProcessor,
  ],
  exports: [
    ContestService,
    ContestLeaderboardService,
    ContestSubmissionService,
    ContestSseService,
  ],
})
export class ContestModule {}

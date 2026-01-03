import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BackoffOptions } from 'bullmq';

import { User } from '../auth/entities/user.entity';
import { Judge0Module } from '../judge0/judge0.module';
import { MailModule } from '../mail';
import { Problem } from '../problems/entities/problem.entity';
import { ProblemsModule } from '../problems/problems.module';
import { ProgrammingLanguageModule } from '../programming-language';
import { RedisModule } from '../redis';
import { StorageModule } from '../storage/storage.module';
import { ContestModule } from '../contest/contest.module';
import { SUBMISSION_QUEUES } from './constants/submission.constants';
import { Judge0CallbackController } from './controllers/judge0-callback.controller';
import { Submission } from './entities/submission.entity';
import { UserProblemProgress } from './entities/user-problem-progress.entity';
import { SubmissionEventHandlers } from './events/submission.event-handlers';
import { GlobalRankingListener } from './listeners/global-ranking.listener';
import { CronRebuildRankingJob } from './jobs/cron-rebuild-ranking.job';
import { SubmissionFinalizeProcessor } from './processors/submission-finalize.processor';
import {
  CallbackProcessorService,
  Judge0PayloadBuilderService,
  ResultDescriptionGeneratorService,
  SubmissionAnalysisService,
  SubmissionQueryBuilderService,
  SubmissionResultBuilderService,
  SubmissionRetrievalService,
  SubmissionSseService,
  SubmissionStatsCalculatorService,
  SubmissionTrackerService,
  TestcaseReaderService,
  UserProgressService,
  UserStatisticsService,
} from './services';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, UserProblemProgress, Problem, User]),
    BullModule.registerQueueAsync({
      name: SUBMISSION_QUEUES.FINALIZE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('redis.host')!;
        const redisPort = configService.get<number>('redis.port')!;
        const redisPassword = configService.get<string>('redis.password');
        const redisUsername = configService.get<string>('redis.username');

        return {
          connection: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            username: redisUsername,
          },
          defaultJobOptions: {
            attempts: configService.get<number>('submission.job.attempts'),
            backoff: configService.get<object>(
              'submission.job.backoff',
            ) as BackoffOptions,
            removeOnComplete: configService.get<boolean>(
              'submission.job.removeOnComplete',
            ),
            removeOnFail: configService.get<number>(
              'submission.job.removeOnFail',
            ),
          },
        };
      },
    }),
    ProblemsModule,
    Judge0Module,
    ProgrammingLanguageModule,
    RedisModule,
    StorageModule,
    MailModule,
    forwardRef(() => ContestModule),
  ],
  controllers: [SubmissionsController, Judge0CallbackController],
  providers: [
    // Main service
    SubmissionsService,

    // Specialized services (following SRP)
    SubmissionQueryBuilderService,
    SubmissionRetrievalService,
    SubmissionAnalysisService,
    CallbackProcessorService,
    SubmissionResultBuilderService,
    SubmissionSseService,
    SubmissionStatsCalculatorService,
    ResultDescriptionGeneratorService,
    Judge0PayloadBuilderService,
    SubmissionTrackerService,
    TestcaseReaderService,
    UserProgressService,
    UserStatisticsService,

    // Event handlers
    SubmissionEventHandlers,
    GlobalRankingListener,

    // Processors
    SubmissionFinalizeProcessor,

    // Jobs
    CronRebuildRankingJob,
    SubmissionFinalizeProcessor,
  ],
  exports: [
    SubmissionsService,
    CallbackProcessorService,
    UserStatisticsService,
    UserProgressService,
  ],
})
export class SubmissionsModule {}

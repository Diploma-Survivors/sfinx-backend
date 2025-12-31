import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Problem } from '../problems/entities/problem.entity';
import { StorageModule } from '../storage/storage.module';
import { Submission } from '../submissions/entities/submission.entity';
import { ContestController } from './controllers/contest.controller';
import { ContestLeaderboardController } from './controllers/contest-leaderboard.controller';
import { ContestProblemsController } from './controllers/contest-problems.controller';
import { Contest } from './entities';
import { ContestParticipant } from './entities';
import { ContestProblem } from './entities';
import {
  ContestLeaderboardService,
  ContestService,
  ContestSseService,
  ContestSubmissionService,
} from './services';
import { ContestStatisticsService } from './services/contest-statistics.service';

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
  ],
  exports: [
    ContestService,
    ContestLeaderboardService,
    ContestSubmissionService,
    ContestSseService,
  ],
})
export class ContestModule {}

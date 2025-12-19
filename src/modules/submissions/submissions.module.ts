import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Judge0Module } from '../judge0/judge0.module';
import { ProblemsModule } from '../problems/problems.module';
import { ProgrammingLanguageModule } from '../programming-language';
import { StorageModule } from '../storage/storage.module';
import { Submission } from './entities/submission.entity';
import { UserProblemProgress } from './entities/user-problem-progress.entity';
import {
  Judge0PayloadBuilderService,
  SubmissionTrackerService,
  UserProgressService,
  UserStatisticsService,
} from './services';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, UserProblemProgress]),
    ProblemsModule,
    Judge0Module,
    ProgrammingLanguageModule,
    StorageModule,
  ],
  controllers: [SubmissionsController],
  providers: [
    SubmissionsService,
    Judge0PayloadBuilderService,
    SubmissionTrackerService,
    UserProgressService,
    UserStatisticsService,
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}

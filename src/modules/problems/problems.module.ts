import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContestProblem } from '../contest/entities/contest-problem.entity';
import { StorageModule } from '../storage/storage.module';
import { Submission } from '../submissions/entities/submission.entity';
import { UserProblemProgress } from '../submissions/entities/user-problem-progress.entity';
import { CommentsModule } from './comments/comments.module';
import { Problem } from './entities/problem.entity';
import { SampleTestcase } from './entities/sample-testcase.entity';
import { Tag } from './entities/tag.entity';
import { Topic } from './entities/topic.entity';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { ProblemStatisticsService } from './services/problem-statistics.service';
import { SampleTestcaseService } from './services';
import { TagService } from './services';
import { TestcaseFileService } from './services';
import { TopicService } from './services';
import { TestcaseTransformService } from './services/testcase-transform.service';
import { TestcaseValidationService } from './services/testcase-validation.service';
import { TagsController } from './tags.controller';
import { TopicsController } from './topics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Problem,
      SampleTestcase,
      Topic,
      Tag,
      UserProblemProgress,
      Submission,
      ContestProblem,
    ]),
    StorageModule,
    CommentsModule,
  ],
  controllers: [ProblemsController, TagsController, TopicsController],
  providers: [
    ProblemsService,
    ProblemStatisticsService,
    TestcaseFileService,
    SampleTestcaseService,
    TestcaseValidationService,
    TestcaseTransformService,
    TagService,
    TopicService,
  ],
  exports: [
    ProblemsService,
    TestcaseFileService,
    SampleTestcaseService,
    TestcaseValidationService,
    TestcaseTransformService,
    TagService,
    TopicService,
    CommentsModule,
  ],
})
export class ProblemsModule {}

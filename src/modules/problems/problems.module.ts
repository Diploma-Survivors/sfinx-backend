import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Problem } from './entities/problem.entity';
import { SampleTestcase } from './entities/sample-testcase.entity';
import { Tag } from './entities/tag.entity';
import { Topic } from './entities/topic.entity';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import {
  SampleTestcaseService,
  TagService,
  TestcaseFileService,
  TopicService,
} from './services';
import { TestcaseTransformService } from './services/testcase-transform.service';
import { TestcaseValidationService } from './services/testcase-validation.service';
import { StorageModule } from '../storage/storage.module';
import { TagsController } from './tags.controller';
import { TopicsController } from './topics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Problem, SampleTestcase, Topic, Tag]),
    StorageModule,
  ],
  controllers: [ProblemsController, TagsController, TopicsController],
  providers: [
    ProblemsService,
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
  ],
})
export class ProblemsModule {}

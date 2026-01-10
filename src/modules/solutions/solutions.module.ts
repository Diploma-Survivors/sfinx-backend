import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { SolutionsController } from './solutions.controller';
import { SolutionCommentsController } from './solution-comments.controller';
import { SolutionsService } from './solutions.service';
import { Solution } from './entities/solution.entity';
import { SolutionComment } from './entities/solution-comment.entity';
import { SolutionVote } from './entities/solution-vote.entity';
import { SolutionCommentVote } from './entities/solution-comment-vote.entity';
import { Problem } from '../problems/entities/problem.entity';
import { Tag } from '../problems/entities/tag.entity';
import { ProgrammingLanguage } from '../programming-language';
import { User } from '../auth/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SolutionCommentsService } from './services/solution-comments.service';
import { SolutionVotesService } from './services/solution-votes.service';
import { CommentsModule } from '../problems/comments/comments.module';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([
      Solution,
      SolutionComment,
      SolutionVote,
      SolutionCommentVote,
      Problem,
      Tag,
      ProgrammingLanguage,
      User,
    ]),
    AuthModule,
    CommentsModule,
  ],
  controllers: [SolutionsController, SolutionCommentsController],
  providers: [SolutionsService, SolutionCommentsService, SolutionVotesService],
  exports: [SolutionsService, SolutionCommentsService, SolutionVotesService],
})
export class SolutionsModule {}

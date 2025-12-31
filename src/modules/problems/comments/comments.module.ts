import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarkdownService } from '../../../common';
import { StorageModule } from '../../storage/storage.module';
import { CommentsController, CommentReportsController } from './controllers';
import { ProblemComment, ProblemCommentVote, CommentReport } from './entities';
import { ProblemCommentsService, CommentReportsService } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProblemComment,
      ProblemCommentVote,
      CommentReport,
    ]),
    StorageModule,
  ],
  controllers: [CommentsController, CommentReportsController],
  providers: [MarkdownService, ProblemCommentsService, CommentReportsService],
  exports: [ProblemCommentsService, CommentReportsService],
})
export class CommentsModule {}

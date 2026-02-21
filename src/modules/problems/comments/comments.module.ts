import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarkdownService } from '../../../common';
import { StorageModule } from '../../storage/storage.module';
import {
  ProblemCommentsController,
  CommentReportsController,
} from './controllers';
import { ProblemComment, ProblemCommentVote, CommentReport } from './entities';
import { ProblemCommentsService, CommentReportsService } from './services';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProblemComment,
      ProblemCommentVote,
      CommentReport,
    ]),
    StorageModule,
    NotificationsModule,
  ],
  controllers: [ProblemCommentsController, CommentReportsController],
  providers: [MarkdownService, ProblemCommentsService, CommentReportsService],
  exports: [ProblemCommentsService, CommentReportsService],
})
export class CommentsModule {}

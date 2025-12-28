import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarkdownService } from '../../../common';
import { StorageModule } from '../../storage/storage.module';
import { CommentsController, CommentReportsController } from './controllers';
import { Comment, CommentVote, CommentReport } from './entities';
import {
  CommentsService,
  CommentVotesService,
  CommentReportsService,
} from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentVote, CommentReport]),
    StorageModule,
  ],
  controllers: [CommentsController, CommentReportsController],
  providers: [
    MarkdownService,
    CommentsService,
    CommentVotesService,
    CommentReportsService,
  ],
  exports: [CommentsService, CommentVotesService, CommentReportsService],
})
export class CommentsModule {}

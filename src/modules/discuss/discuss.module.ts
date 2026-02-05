import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { DiscussTag } from './entities/discuss-tag.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostVote } from './entities/post-vote.entity';
import { PostCommentVote } from './entities/post-comment-vote.entity';
import { DiscussController } from './controllers/discuss.controller';
import { DiscussCommentController } from './controllers/discuss-comment.controller';
import { DiscussService } from './services/discuss.service';
import { DiscussCommentService } from './services/discuss-comment.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      DiscussTag,
      PostComment,
      PostVote,
      PostCommentVote,
    ]),
    StorageModule,
  ],
  controllers: [DiscussController, DiscussCommentController],
  providers: [DiscussService, DiscussCommentService],
  exports: [DiscussService],
})
export class DiscussModule {}

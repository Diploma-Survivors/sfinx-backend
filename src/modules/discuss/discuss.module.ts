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
import { DiscussTagService } from './services/discuss-tag.service';
import { StorageModule } from '../storage/storage.module';

import { DiscussTagsController } from './controllers/discuss-tags.controller';
import { DiscussAdminController } from './controllers/discuss-admin.controller';

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
  controllers: [
    DiscussAdminController,
    DiscussTagsController,
    DiscussController,
    DiscussCommentController,
  ],
  providers: [DiscussService, DiscussCommentService, DiscussTagService],
  exports: [DiscussService, DiscussTagService],
})
export class DiscussModule {}

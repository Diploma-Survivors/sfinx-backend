import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { DiscussTag } from './entities/discuss-tag.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostVote } from './entities/post-vote.entity';
import { PostCommentVote } from './entities/post-comment-vote.entity';
import { DiscussController } from './controllers/discuss.controller';
import { DiscussService } from './services/discuss.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      DiscussTag,
      PostComment,
      PostVote,
      PostCommentVote,
    ]),
  ],
  controllers: [DiscussController],
  providers: [DiscussService],
  exports: [DiscussService],
})
export class DiscussModule {}

import {
  Entity,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { BaseCommentVote } from '../../comments-base/entities/base-comment-vote.entity';
import { VoteType } from '../../comments-base/enums';
import { User } from '../../auth/entities/user.entity';
import { PostComment } from './post-comment.entity';

@Entity('discuss_comment_votes')
@Unique(['userId', 'commentId'])
export class PostCommentVote implements BaseCommentVote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'comment_id' })
  commentId: number;

  @Column({
    name: 'vote_type',
    type: 'varchar',
    length: 10,
  })
  voteType: VoteType;

  @ManyToOne(() => PostComment, (comment) => comment.votes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'comment_id' })
  comment: PostComment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

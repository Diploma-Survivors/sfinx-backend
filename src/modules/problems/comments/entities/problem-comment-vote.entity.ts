import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../../auth/entities/user.entity';
import { ProblemComment } from './problem-comment.entity';
import { VoteType } from '../enums';

import { BaseCommentVote } from '../../../comments-base/entities/base-comment-vote.entity';

/**
 * CommentVote entity
 * Composite primary key (commentId, userId) ensures one vote per user per comment
 */
@Entity('problem_comment_votes')
export class ProblemCommentVote extends BaseCommentVote {
  @PrimaryColumn({ name: 'comment_id' })
  commentId!: number;

  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @Column({
    name: 'vote_type',
    type: 'enum',
    enum: VoteType,
  })
  declare voteType: VoteType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ProblemComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: ProblemComment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

import { ApiProperty } from '@nestjs/swagger';
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
import { Comment } from './comment.entity';
import { VoteType } from '../enums';

/**
 * CommentVote entity
 * Composite primary key (commentId, userId) ensures one vote per user per comment
 */
@Entity('comment_votes')
export class CommentVote {
  @ApiProperty({ description: 'Comment ID being voted on' })
  @PrimaryColumn({ name: 'comment_id' })
  commentId: number;

  @ApiProperty({ description: 'User ID who cast the vote' })
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @ApiProperty({
    description: 'Vote type: upvote (+1) or downvote (-1)',
    enum: VoteType,
    example: VoteType.UPVOTE,
  })
  @Column({
    type: 'enum',
    enum: VoteType,
  })
  voteType: VoteType;

  @ApiProperty({ description: 'Vote creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty({ description: 'Vote last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ApiProperty({
    description: 'Comment being voted on',
    type: () => Comment,
  })
  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

  @ApiProperty({
    description: 'User who cast the vote',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

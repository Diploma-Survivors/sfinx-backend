import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Solution } from './solution.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * Solution Comment entity
 * Supports unlimited nesting via self-referencing parent-child relationship
 */
@Entity('solution_comments')
export class SolutionComment {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Solution ID this comment belongs to' })
  @Column({ name: 'solution_id' })
  solutionId: number;

  @ApiProperty({ description: 'User ID of the comment author' })
  @Column({ name: 'author_id' })
  authorId: number;

  @ApiProperty({
    description: 'Parent comment ID for nested replies',
    nullable: true,
    required: false,
  })
  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @ApiProperty({
    description: 'Comment content in markdown format',
    example: '**Great solution!** very clear.',
  })
  @Column('text')
  content: string;

  @ApiProperty({ description: 'Total upvotes count', default: 0 })
  @Column({ name: 'upvote_count', default: 0 })
  upvoteCount: number;

  @ApiProperty({ description: 'Total downvotes count', default: 0 })
  @Column({ name: 'downvote_count', default: 0 })
  downvoteCount: number;

  @ApiProperty({ description: 'Total number of replies', default: 0 })
  @Column({ name: 'reply_count', default: 0 })
  replyCount: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ApiProperty({
    description: 'Solution this comment belongs to',
    type: () => Solution,
  })
  @ManyToOne(() => Solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solution_id' })
  solution: Solution;

  @ApiProperty({
    description: 'Comment author',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ApiProperty({
    description: 'Parent comment for nested replies',
    type: () => SolutionComment,
    nullable: true,
    required: false,
  })
  @ManyToOne(() => SolutionComment, (comment) => comment.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parentComment: SolutionComment | null;

  @ApiProperty({
    description: 'Nested replies to this comment',
    type: () => [SolutionComment],
    required: false,
  })
  @OneToMany(() => SolutionComment, (comment) => comment.parentComment)
  replies: SolutionComment[];

  // Non-column properties
  @ApiProperty({
    description: 'Current user vote status',
    enum: ['up_vote', 'down_vote', null],
    nullable: true,
  })
  myVote: 'up_vote' | 'down_vote' | null;

  // Frontend alias for replyCount
  @ApiProperty({ description: 'Total number of replies (frontend alias)' })
  replyCounts: number;
}

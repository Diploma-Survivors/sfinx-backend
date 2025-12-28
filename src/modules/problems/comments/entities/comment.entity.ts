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

import { Problem } from '../../entities/problem.entity';
import { User } from '../../../auth/entities/user.entity';
import { CommentType } from '../enums';

/**
 * Comment entity
 * Supports unlimited nesting via self-referencing parent-child relationship
 */
@Entity('comments')
export class Comment {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Problem ID this comment belongs to' })
  @Column({ name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'User ID of the comment author' })
  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({
    description: 'Parent comment ID for nested replies',
    nullable: true,
    required: false,
  })
  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @ApiProperty({
    description: 'Comment content in markdown format',
    example: '**Great problem!** I solved it using two pointers approach.',
  })
  @Column('text')
  content: string;

  @ApiProperty({
    description: 'Comment type for categorization',
    enum: CommentType,
    example: CommentType.FEEDBACK,
  })
  @Column({
    type: 'enum',
    enum: CommentType,
    default: CommentType.FEEDBACK,
  })
  type: CommentType;

  @ApiProperty({
    description: 'Whether this comment is pinned by moderators',
    default: false,
  })
  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @ApiProperty({
    description: 'Whether this comment has been edited',
    default: false,
  })
  @Column({ name: 'is_edited', default: false })
  isEdited: boolean;

  @ApiProperty({
    description: 'Soft delete flag - preserves tree structure',
    default: false,
  })
  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @ApiProperty({ description: 'Total upvotes count', default: 0 })
  @Column({ name: 'upvote_count', default: 0 })
  upvoteCount: number;

  @ApiProperty({ description: 'Total downvotes count', default: 0 })
  @Column({ name: 'downvote_count', default: 0 })
  downvoteCount: number;

  @ApiProperty({
    description: 'Net vote score (upvotes - downvotes)',
    default: 0,
  })
  @Column({ name: 'vote_score', default: 0 })
  voteScore: number;

  @ApiProperty({ description: 'Total number of replies', default: 0 })
  @Column({ name: 'reply_count', default: 0 })
  replyCount: number;

  @ApiProperty({ description: 'Number of reports on this comment', default: 0 })
  @Column({ name: 'report_count', default: 0 })
  reportCount: number;

  @ApiProperty({
    description: 'Last edit timestamp',
    nullable: true,
    required: false,
  })
  @Column({
    name: 'edited_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  editedAt: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ApiProperty({
    description: 'Problem this comment belongs to',
    type: () => Problem,
  })
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ApiProperty({
    description: 'Comment author',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  author: User;

  @ApiProperty({
    description: 'Parent comment for nested replies',
    type: () => Comment,
    nullable: true,
    required: false,
  })
  @ManyToOne(() => Comment, (comment) => comment.replies, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parentComment: Comment | null;

  @ApiProperty({
    description: 'Nested replies to this comment',
    type: () => [Comment],
    required: false,
  })
  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];
}

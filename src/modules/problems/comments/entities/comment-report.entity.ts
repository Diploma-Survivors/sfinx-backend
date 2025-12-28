import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../../auth/entities/user.entity';
import { ReportReason } from '../enums';
import { Comment } from './comment.entity';

/**
 * CommentReport entity
 * Tracks user reports for inappropriate comments
 */
@Entity('comment_reports')
export class CommentReport {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Comment ID being reported' })
  @Column({ name: 'comment_id' })
  commentId: number;

  @ApiProperty({ description: 'User ID who submitted the report' })
  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({
    description: 'Reason for reporting',
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @ApiProperty({
    description: 'Optional detailed description of the issue',
    nullable: true,
    required: false,
  })
  @Column('text', { nullable: true })
  description: string | null;

  @ApiProperty({
    description: 'Whether the report has been reviewed and resolved',
    default: false,
  })
  @Column({ name: 'is_resolved', default: false })
  isResolved: boolean;

  @ApiProperty({
    description: 'Timestamp when report was resolved',
    nullable: true,
    required: false,
  })
  @Column({
    name: 'resolved_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  resolvedAt: Date | null;

  @ApiProperty({
    description: 'Admin/moderator user ID who resolved the report',
    nullable: true,
    required: false,
  })
  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: number | null;

  @ApiProperty({ description: 'Report creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  // Relations
  @ApiProperty({
    description: 'Comment being reported',
    type: () => Comment,
  })
  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

  @ApiProperty({
    description: 'User who submitted the report',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  reporter: User;

  @ApiProperty({
    description: 'Admin/moderator who resolved the report',
    type: () => User,
    nullable: true,
    required: false,
  })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolver: User | null;
}

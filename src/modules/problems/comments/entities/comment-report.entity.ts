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
import { ProblemComment } from './problem-comment.entity';

/**
 * CommentReport entity
 * Tracks user reports for inappropriate comments
 */
@Entity('comment_reports')
export class CommentReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'comment_id' })
  commentId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({ name: 'is_resolved', default: false })
  isResolved: boolean;

  @Column({
    name: 'resolved_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => ProblemComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: ProblemComment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  reporter: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolver: User | null;
}

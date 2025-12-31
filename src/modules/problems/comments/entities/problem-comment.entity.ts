import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Problem } from '../../entities/problem.entity';
import { CommentType } from '../enums';
import { BaseComment } from '../../../comments-base/entities/base-comment.entity';

/**
 * Comment entity
 * Supports unlimited nesting via self-referencing parent-child relationship
 */
@Entity('problem_comments')
export class ProblemComment extends BaseComment {
  @Column({ name: 'problem_id' })
  problemId: number;

  @Column({
    type: 'enum',
    enum: CommentType,
    default: CommentType.FEEDBACK,
  })
  type: CommentType;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({ name: 'is_edited', default: false })
  isEdited: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'vote_score', default: 0 })
  voteScore: number;

  @Column({ name: 'report_count', default: 0 })
  reportCount: number;

  @Column({
    name: 'edited_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  editedAt: Date | null;

  // Relations
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ManyToOne(() => ProblemComment, (comment) => comment.replies, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parentComment: ProblemComment | null;

  @OneToMany(() => ProblemComment, (comment) => comment.parentComment)
  replies: ProblemComment[];
}

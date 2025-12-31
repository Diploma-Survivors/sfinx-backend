import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Solution } from './solution.entity';
import { BaseComment } from '../../comments-base/entities/base-comment.entity';

/**
 * Solution Comment entity
 */
@Entity('solution_comments')
export class SolutionComment extends BaseComment {
  @Column({ name: 'solution_id' })
  solutionId: number;

  @ManyToOne(() => Solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solution_id' })
  solution: Solution;

  @ManyToOne(() => SolutionComment, (comment) => comment.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parentComment: SolutionComment | null;

  @OneToMany(() => SolutionComment, (comment) => comment.replies)
  replies: SolutionComment[];
}

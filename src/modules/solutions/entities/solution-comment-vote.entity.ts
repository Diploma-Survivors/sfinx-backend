import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SolutionComment } from './solution-comment.entity';
import { User } from '../../auth/entities/user.entity';
import { VoteType } from '../enums/vote-type.enum';

@Entity('solution_comment_votes')
export class SolutionCommentVote {
  @PrimaryColumn({ name: 'comment_id' })
  commentId: number;

  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: VoteType,
    name: 'vote_type',
  })
  voteType: VoteType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => SolutionComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: SolutionComment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

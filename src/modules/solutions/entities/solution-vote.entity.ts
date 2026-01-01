import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Solution } from './solution.entity';
import { User } from '../../auth/entities/user.entity';
import { VoteType } from '../../comments-base/enums';
import { BaseVote } from '../../comments-base/entities/base-vote.entity';

@Entity('solution_votes')
export class SolutionVote extends BaseVote {
  @PrimaryColumn({ name: 'solution_id' })
  solutionId: number;

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

  @ManyToOne(() => Solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solution_id' })
  solution: Solution;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

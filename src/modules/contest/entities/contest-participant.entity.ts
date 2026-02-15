import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Contest } from './contest.entity';

/**
 * Score breakdown for a single problem
 */
export interface ProblemScore {
  score: number;
  submissions: number;
  lastSubmitTime: string | null;
  firstAcTime?: string | null;
}

@Entity('contest_participants')
export class ContestParticipant {
  @ApiProperty({ description: 'Contest ID' })
  @PrimaryColumn('int', { name: 'contest_id' })
  contestId: number;

  @ApiProperty({ description: 'User ID' })
  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Contest', type: () => Contest })
  @ManyToOne(() => Contest, (contest) => contest.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contest_id' })
  contest: Contest;

  @ApiProperty({ description: 'User', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'Total score (IOI style)', default: 0 })
  @Column({
    name: 'total_score',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalScore: number;

  @ApiProperty({ description: 'Number of problems solved', default: 0 })
  @Column({ name: 'solved_count', type: 'int', default: 0 })
  solvedCount: number;

  @ApiProperty({
    description: 'Sum of time (ms) for all first AC submissions',
    default: 0,
  })
  @Column({
    name: 'finish_time',
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  finishTime: number;

  @VersionColumn()
  version: number;

  @ApiProperty({
    description: 'Score breakdown per problem',
    example: {
      '1': {
        score: 75,
        submissions: 2,
        lastSubmitTime: '2024-01-01T12:00:00Z',
      },
    },
  })
  @Column({ name: 'problem_scores', type: 'jsonb', default: {} })
  problemScores: Record<number, ProblemScore>;

  @ApiProperty({ description: 'Total number of submissions', default: 0 })
  @Column({ name: 'total_submissions', default: 0 })
  totalSubmissions: number;

  @ApiPropertyOptional({
    description: 'Last submission timestamp for tiebreaker',
  })
  @Column({ name: 'last_submission_at', type: 'timestamptz', nullable: true })
  lastSubmissionAt: Date | null;

  @ApiPropertyOptional({ description: 'ELO rating before this contest' })
  @Column({ name: 'rating_before', type: 'int', nullable: true })
  ratingBefore: number | null;

  @ApiPropertyOptional({ description: 'ELO rating after this contest' })
  @Column({ name: 'rating_after', type: 'int', nullable: true })
  ratingAfter: number | null;

  @ApiPropertyOptional({ description: 'ELO rating change from this contest' })
  @Column({ name: 'rating_delta', type: 'int', nullable: true })
  ratingDelta: number | null;

  @ApiPropertyOptional({
    description: 'Final rank in this contest (for rating)',
  })
  @Column({ name: 'contest_rank', type: 'int', nullable: true })
  contestRank: number | null;

  @ApiProperty({ description: 'Start timestamp (when user joined)' })
  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

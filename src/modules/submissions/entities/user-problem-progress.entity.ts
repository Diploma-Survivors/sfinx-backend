import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { ProgressStatus } from '../enums/progress-status.enum';
import { Submission } from './submission.entity';

@Entity('user_problem_progress')
export class UserProblemProgress {
  @ApiProperty({ description: 'User ID' })
  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Problem ID' })
  @PrimaryColumn('int', { name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'User', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'Problem', type: () => Problem })
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ApiProperty({
    description: 'Progress status',
    enum: ProgressStatus,
    example: ProgressStatus.SOLVED,
  })
  @Column({
    type: 'enum',
    enum: ProgressStatus,
    default: ProgressStatus.ATTEMPTED,
  })
  status: ProgressStatus;

  @ApiProperty({ description: 'Total number of attempts' })
  @Column({ name: 'total_attempts', default: 0 })
  totalAttempts: number;

  @ApiProperty({ description: 'Total accepted submissions' })
  @Column({ name: 'total_accepted', default: 0 })
  totalAccepted: number;

  @ApiProperty({
    description: 'Best submission',
    type: () => Submission,
    required: false,
  })
  @ManyToOne(() => Submission, { nullable: true })
  @JoinColumn({ name: 'best_submission_id' })
  bestSubmission: Submission | null;

  @ApiProperty({ description: 'Best runtime in milliseconds', required: false })
  @Column({ name: 'best_runtime_ms', type: 'float', nullable: true })
  bestRuntimeMs: number | null;

  @ApiProperty({ description: 'Best memory usage in KB', required: false })
  @Column({ name: 'best_memory_kb', type: 'float', nullable: true })
  bestMemoryKb: number | null;

  @ApiProperty({ description: 'First attempt timestamp' })
  @CreateDateColumn({ name: 'first_attempted_at', type: 'timestamptz' })
  firstAttemptedAt: Date;

  @ApiProperty({ description: 'First solve timestamp', required: false })
  @Column({ name: 'first_solved_at', type: 'timestamptz', nullable: true })
  firstSolvedAt: Date | null;

  @ApiProperty({ description: 'Last attempt timestamp', required: false })
  @Column({ name: 'last_attempted_at', type: 'timestamptz', nullable: true })
  lastAttemptedAt: Date | null;
}

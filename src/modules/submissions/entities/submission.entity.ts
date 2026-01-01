import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Contest } from '../../contest/entities';
import { Problem } from '../../problems/entities/problem.entity';
import { ProgrammingLanguage } from '../../programming-language';
import { SubmissionStatus } from '../enums';
import type { ResultDescription } from '../interfaces';

@Entity('submissions')
export class Submission {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'User ID who made the submission' })
  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({
    description: 'User who made the submission',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'Problem ID' })
  @Column({ name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'Problem being solved', type: () => Problem })
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ApiProperty({
    description: 'Programming language used',
    type: () => ProgrammingLanguage,
  })
  @ManyToOne(() => ProgrammingLanguage)
  @JoinColumn({ name: 'language_id' })
  language: ProgrammingLanguage;

  @ApiProperty({ description: 'Submitted code' })
  @Column({ name: 'source_code', type: 'text', nullable: true })
  sourceCode: string | null;

  @ApiProperty({
    description: 'Submission status',
    enum: SubmissionStatus,
    example: SubmissionStatus.ACCEPTED,
  })
  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  status: SubmissionStatus;

  @ApiProperty({ description: 'Number of testcases passed' })
  @Column({ name: 'passed_testcases', default: 0 })
  passedTestcases: number;

  @ApiProperty({ description: 'Total number of testcases' })
  @Column({ name: 'total_testcases', default: 0 })
  totalTestcases: number;

  @ApiProperty({ description: 'Runtime in milliseconds', required: false })
  @Column({ name: 'runtime_ms', type: 'float', nullable: true })
  runtimeMs: number | null;

  @ApiProperty({ description: 'Memory used in KB', required: false })
  @Column({ name: 'memory_kb', type: 'float', nullable: true })
  memoryKb: number | null;

  @ApiProperty({
    description: 'Failed testcase results',
    example: [
      {
        message: 'Wrong answer',
        input: '1',
        expectedOutput: '2',
        actualOutput: '3',
      },
    ],
  })
  @Column({ name: 'result_description', type: 'jsonb', nullable: true })
  resultDescription: ResultDescription | null;

  @ApiProperty({ description: 'IP address of submitter', required: false })
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ description: 'Submission timestamp' })
  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @ApiProperty({ description: 'Judging completion timestamp', required: false })
  @Column({ name: 'judged_at', type: 'timestamptz', nullable: true })
  judgedAt: Date | null;

  @ApiProperty({
    description: 'Penalty time in minutes for contests',
    required: false,
  })
  @Column({ name: 'penalty_time', default: 0 })
  penaltyTime: number;

  @ApiProperty({
    description: 'Whether submission was after contest ended',
    required: false,
  })
  @Column({ name: 'is_after_contest', default: false })
  isAfterContest: boolean;

  @ApiPropertyOptional({
    description: 'Contest ID if this is a contest submission',
  })
  @Column({ name: 'contest_id', nullable: true })
  contestId: number | null;

  @ApiPropertyOptional({ description: 'Contest', type: () => Contest })
  @ManyToOne(() => Contest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contest_id' })
  contest: Contest | null;
}

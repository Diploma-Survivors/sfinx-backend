import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';

export enum ProblemReportType {
  WRONG_DESCRIPTION = 'WRONG_DESCRIPTION',
  WRONG_ANSWER = 'WRONG_ANSWER',
  WRONG_TEST_CASE = 'WRONG_TEST_CASE',
  OTHER = 'OTHER',
}

export enum ProblemReportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

@Entity('problem_reports')
export class ProblemReport {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Type of report', enum: ProblemReportType })
  @Column({
    type: 'enum',
    enum: ProblemReportType,
  })
  type: ProblemReportType;

  @ApiProperty({ description: 'Detailed description of the issue' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Resolution status', enum: ProblemReportStatus })
  @Column({
    type: 'enum',
    enum: ProblemReportStatus,
    default: ProblemReportStatus.PENDING,
  })
  status: ProblemReportStatus;

  // Relations
  @ApiProperty({ description: 'User who reported' })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Problem being reported' })
  @ManyToOne(() => Problem)
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @Column({ name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { ContestStatus } from '../enums';
import { ContestParticipant } from './contest-participant.entity';
import { ContestProblem } from './contest-problem.entity';

@Entity('contests')
export class Contest {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Contest title', example: 'Weekly Contest #1' })
  @Column({ length: 255 })
  title: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'weekly-contest-1',
  })
  @Column({ unique: true, length: 255 })
  slug: string;

  @ApiPropertyOptional({ description: 'Contest description in markdown' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ description: 'Contest rules in markdown' })
  @Column({ type: 'text', nullable: true })
  rules: string | null;

  @ApiProperty({ description: 'Contest start time' })
  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @ApiProperty({ description: 'Contest end time' })
  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @ApiProperty({
    description: 'Contest status',
    enum: ContestStatus,
    example: ContestStatus.SCHEDULED,
  })
  @Column({
    type: 'enum',
    enum: ContestStatus,
    default: ContestStatus.DRAFT,
  })
  status: ContestStatus;

  @ApiProperty({ description: 'Total number of participants', default: 0 })
  @Column({ name: 'participant_count', default: 0 })
  participantCount: number;

  @ApiProperty({
    description: 'Maximum participants allowed (0 = unlimited)',
    default: 0,
  })
  @Column({ name: 'max_participants', default: 0 })
  maxParticipants: number;

  @ApiProperty({
    description: 'Duration in minutes for display purposes',
    example: 90,
  })
  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  @ApiProperty({
    description: 'Contest problems',
    type: () => [ContestProblem],
  })
  @OneToMany(() => ContestProblem, (cp) => cp.contest, { cascade: true })
  contestProblems: ContestProblem[];

  @ApiProperty({
    description: 'Contest participants',
    type: () => [ContestParticipant],
  })
  @OneToMany(() => ContestParticipant, (cp) => cp.contest)
  participants: ContestParticipant[];

  @ApiPropertyOptional({
    description: 'User who created the contest',
    type: () => User,
  })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

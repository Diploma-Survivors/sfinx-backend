import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { InterviewMessage } from './interview-message.entity';
import { InterviewEvaluation } from './interview-evaluation.entity';
import {
  InterviewMode,
  InterviewDifficulty,
  InterviewerPersonality,
} from '../enums';

export enum InterviewStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export interface ProblemSnapshot {
  title?: string;
  description?: string;
  difficulty?: string;
  latestCode?: string;
  codeLanguage?: string;
  codeUpdatedAt?: number;
  [key: string]: unknown;
}

@Entity('ai_interviews')
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'problem_id' })
  problemId: number;

  @Column('jsonb', { name: 'problem_snapshot' })
  problemSnapshot: ProblemSnapshot;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  @Column({
    type: 'enum',
    enum: InterviewStatus,
    default: InterviewStatus.ACTIVE,
  })
  status: InterviewStatus;

  @Column({
    type: 'enum',
    enum: InterviewMode,
    default: InterviewMode.STANDARD,
    name: 'interview_mode',
  })
  mode: InterviewMode;

  @Column({
    type: 'enum',
    enum: InterviewDifficulty,
    default: InterviewDifficulty.ENTRY,
    name: 'interview_difficulty',
  })
  difficulty: InterviewDifficulty;

  @Column({
    type: 'enum',
    enum: InterviewerPersonality,
    default: InterviewerPersonality.EASY_GOING,
    name: 'interviewer_personality',
  })
  personality: InterviewerPersonality;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date;

  @OneToMany(() => InterviewMessage, (message) => message.interview, {
    cascade: true,
  })
  messages: InterviewMessage[];

  @OneToOne(() => InterviewEvaluation, (evaluation) => evaluation.interview, {
    cascade: true,
  })
  evaluation: InterviewEvaluation;
}

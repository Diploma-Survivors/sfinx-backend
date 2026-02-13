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

export enum InterviewStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
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
  problemSnapshot: any;

  @Column({
    type: 'enum',
    enum: InterviewStatus,
    default: InterviewStatus.ACTIVE,
  })
  status: InterviewStatus;

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

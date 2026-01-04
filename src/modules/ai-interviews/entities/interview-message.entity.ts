import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Interview } from './interview.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

@Entity('ai_interview_messages')
export class InterviewMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'interview_id' })
  interviewId: string;

  @ManyToOne(() => Interview, (interview) => interview.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'interview_id' })
  interview: Interview;

  @Column({
    type: 'enum',
    enum: MessageRole,
  })
  role: MessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

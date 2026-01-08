import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Interview } from './interview.entity';

@Entity('ai_interview_evaluations')
export class InterviewEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'interview_id' })
  interviewId: string;

  @OneToOne(() => Interview, (interview) => interview.evaluation, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'interview_id' })
  interview: Interview;

  @Column('float', { name: 'problem_solving_score', default: 0 })
  problemSolvingScore: number;

  @Column('float', { name: 'code_quality_score', default: 0 })
  codeQualityScore: number;

  @Column('float', { name: 'communication_score', default: 0 })
  communicationScore: number;

  @Column('float', { name: 'technical_score', default: 0 })
  technicalScore: number;

  @Column('float', { name: 'overall_score', default: 0 })
  overallScore: number;

  @Column('jsonb', { default: [] })
  strengths: string[];

  @Column('jsonb', { default: [] })
  improvements: string[];

  @Column('text', { name: 'detailed_feedback' })
  detailedFeedback: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

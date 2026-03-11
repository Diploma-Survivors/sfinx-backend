import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from 'src/modules/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnrollmentStatus } from '../enums/enrollment-status.enum';
import { StudyPlan } from './study-plan.entity';

@Entity('study_plan_enrollments')
export class StudyPlanEnrollment {
  @ApiProperty({ description: 'Study plan ID' })
  @PrimaryColumn('int', { name: 'study_plan_id' })
  studyPlanId: number;

  @ApiProperty({ description: 'User ID' })
  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Study plan', type: () => StudyPlan })
  @ManyToOne(() => StudyPlan, (plan) => plan.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'study_plan_id' })
  studyPlan: StudyPlan;

  @ApiProperty({ description: 'User', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'Enrollment status', enum: EnrollmentStatus })
  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ACTIVE,
  })
  status: EnrollmentStatus;

  @ApiProperty({ description: 'Current day the user is on', default: 1 })
  @Column({ name: 'current_day', type: 'int', default: 1 })
  currentDay: number;

  @ApiProperty({
    description: 'Number of problems solved in this plan',
    default: 0,
  })
  @Column({ name: 'solved_count', type: 'int', default: 0 })
  solvedCount: number;

  @ApiPropertyOptional({ description: 'Last activity timestamp' })
  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt: Date | null;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @ApiProperty({ description: 'Enrollment timestamp' })
  @CreateDateColumn({ name: 'enrolled_at', type: 'timestamptz' })
  enrolledAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

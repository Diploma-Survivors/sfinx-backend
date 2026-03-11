import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Problem } from 'src/modules/problems/entities/problem.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StudyPlan } from './study-plan.entity';

@Entity('study_plan_items')
@Unique(['studyPlanId', 'problemId'])
export class StudyPlanItem {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Study plan ID' })
  @Column({ name: 'study_plan_id' })
  studyPlanId: number;

  @ApiProperty({ description: 'Problem ID' })
  @Column({ name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'Day number in the plan', example: 1 })
  @Column({ name: 'day_number', type: 'int' })
  dayNumber: number;

  @ApiProperty({ description: 'Display order within the day', default: 0 })
  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @ApiPropertyOptional({
    description: 'Translatable note for this item',
    example: {
      en: 'Classic hash table problem',
      vi: 'Bài toán bảng băm kinh điển',
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  note: Record<string, string> | null;

  @ApiProperty({ description: 'Study plan', type: () => StudyPlan })
  @ManyToOne(() => StudyPlan, (plan) => plan.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'study_plan_id' })
  studyPlan: StudyPlan;

  @ApiProperty({ description: 'Problem', type: () => Problem })
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;
}

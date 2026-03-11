import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { StudyPlan } from './study-plan.entity';

@Entity('study_plan_translations')
@Unique(['studyPlanId', 'languageCode'])
export class StudyPlanTranslation {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Study plan ID' })
  @Column({ name: 'study_plan_id' })
  studyPlanId: number;

  @ApiProperty({ description: 'Language code (e.g., en, vi)' })
  @Column({ name: 'language_code', length: 10 })
  languageCode: string;

  @ApiProperty({ description: 'Translated plan name' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ description: 'Translated plan description' })
  @Column('text')
  description: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => StudyPlan, (plan) => plan.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'study_plan_id' })
  studyPlan: StudyPlan;
}

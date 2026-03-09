import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tag } from 'src/modules/problems/entities/tag.entity';
import { Topic } from 'src/modules/problems/entities/topic.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudyPlanDifficulty } from '../enums/study-plan-difficulty.enum';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';
import { StudyPlanEnrollment } from './study-plan-enrollment.entity';
import { StudyPlanItem } from './study-plan-item.entity';
import { StudyPlanTranslation } from './study-plan-translation.entity';

@Entity('study_plans')
export class StudyPlan {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'dynamic-programming-mastery',
  })
  @Column({ unique: true, length: 255 })
  slug: string;

  @ApiProperty({ description: 'Difficulty level', enum: StudyPlanDifficulty })
  @Column({ type: 'enum', enum: StudyPlanDifficulty })
  difficulty: StudyPlanDifficulty;

  @ApiProperty({ description: 'Plan status', enum: StudyPlanStatus })
  @Column({
    type: 'enum',
    enum: StudyPlanStatus,
    default: StudyPlanStatus.DRAFT,
  })
  status: StudyPlanStatus;

  @ApiProperty({
    description: 'Estimated number of days to complete',
    example: 14,
  })
  @Column({ name: 'estimated_days', type: 'int' })
  estimatedDays: number;

  @ApiPropertyOptional({ description: 'Cover image S3 key' })
  @Column({ name: 'cover_image_key', type: 'text', nullable: true })
  coverImageKey: string | null;

  @ApiProperty({ description: 'Whether plan requires premium', default: false })
  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @ApiProperty({ description: 'Number of enrolled users', default: 0 })
  @Column({ name: 'enrollment_count', default: 0 })
  enrollmentCount: number;

  @ApiProperty({ description: 'IDs of similar study plans', type: [Number] })
  @Column({ name: 'similar_plan_ids', type: 'int', array: true, default: [] })
  similarPlanIds: number[];

  @ApiProperty({
    description: 'Translations',
    type: () => [StudyPlanTranslation],
  })
  @OneToMany(() => StudyPlanTranslation, (t) => t.studyPlan, { cascade: true })
  translations: StudyPlanTranslation[];

  @ApiProperty({
    description: 'Plan items (problems)',
    type: () => [StudyPlanItem],
  })
  @OneToMany(() => StudyPlanItem, (item) => item.studyPlan, { cascade: true })
  items: StudyPlanItem[];

  @OneToMany(() => StudyPlanEnrollment, (e) => e.studyPlan)
  enrollments: StudyPlanEnrollment[];

  @ApiProperty({ description: 'Associated topics', type: () => [Topic] })
  @ManyToMany(() => Topic)
  @JoinTable({
    name: 'study_plan_topics',
    joinColumn: { name: 'study_plan_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'topic_id', referencedColumnName: 'id' },
  })
  topics: Topic[];

  @ApiProperty({ description: 'Associated tags', type: () => [Tag] })
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'study_plan_tags',
    joinColumn: { name: 'study_plan_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @ApiPropertyOptional({ description: 'Creator', type: () => User })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdById: number | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

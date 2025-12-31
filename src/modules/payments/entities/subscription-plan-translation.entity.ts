import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('subscription_plan_translations')
export class SubscriptionPlanTranslation {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Related Subscription Plan ID' })
  @Column({ name: 'plan_id' })
  planId: number;

  @ApiProperty({ description: 'Language code (e.g., en, vi)' })
  @Column({ name: 'language_code', length: 10 })
  languageCode: string;

  @ApiProperty({ description: 'Translated Plan Name' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: 'Translated Plan Description' })
  @Column('text')
  description: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;
}

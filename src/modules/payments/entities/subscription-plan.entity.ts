import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPlanTranslation } from './subscription-plan-translation.entity';

export enum SubscriptionType {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Subscription Type', enum: SubscriptionType })
  @Column({
    type: 'enum',
    enum: SubscriptionType,
    default: SubscriptionType.MONTHLY,
  })
  type: SubscriptionType;

  @ApiProperty({ description: 'Price in USD', example: 9.99 })
  @Column({ name: 'price_usd', type: 'decimal', precision: 10, scale: 2 })
  priceUsd: number;

  @ApiProperty({ description: 'Duration in months', example: 1 })
  @Column({ name: 'duration_months' })
  durationMonths: number;

  @ApiProperty({ description: 'Is plan active', example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => SubscriptionPlanTranslation,
    (translation) => translation.plan,
  )
  translations: SubscriptionPlanTranslation[];
}

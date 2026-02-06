import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionFeatureTranslation } from './subscription-feature-translation.entity';

@Entity('subscription_features')
export class SubscriptionFeature {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Unique key for code reference',
    example: 'unlimited_submissions',
  })
  @Column({ unique: true, length: 50 })
  key: string;

  @ApiProperty({ description: 'Is feature active', example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => SubscriptionFeatureTranslation,
    (translation) => translation.feature,
  )
  translations: SubscriptionFeatureTranslation[];
}

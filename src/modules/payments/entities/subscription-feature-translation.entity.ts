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
import { SubscriptionFeature } from './subscription-feature.entity';

@Entity('subscription_feature_translations')
export class SubscriptionFeatureTranslation {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Related Feature ID' })
  @Column({ name: 'feature_id' })
  featureId: number;

  @ApiProperty({ description: 'Language code (e.g., en, vi)' })
  @Column({ name: 'language_code', length: 10 })
  languageCode: string;

  @ApiProperty({ description: 'Translated Feature Name' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: 'Translated Feature Description' })
  @Column('text', { nullable: true })
  description: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => SubscriptionFeature, (feature) => feature.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'feature_id' })
  feature: SubscriptionFeature;
}

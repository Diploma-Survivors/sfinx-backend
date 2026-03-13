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
import { FeeConfig } from './fee-config.entity';

@Entity('fee_config_translations')
@Unique('UQ_fee_config_translation_lang', ['feeConfigId', 'languageCode'])
export class FeeConfigTranslation {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Related fee config ID', example: 1 })
  @Column({ name: 'fee_config_id' })
  feeConfigId: number;

  @ApiProperty({ description: 'Language code (en, vi)', example: 'en' })
  @Column({ name: 'language_code', type: 'varchar', length: 10 })
  languageCode: string;

  @ApiProperty({
    description: 'Localized fee name',
    example: 'Value Added Tax',
  })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({
    description: 'Localized fee description',
    example: 'Tax applied on checkout total',
    required: false,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => FeeConfig, (feeConfig) => feeConfig.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fee_config_id' })
  feeConfig: FeeConfig;
}

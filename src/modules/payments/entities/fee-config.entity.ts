import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FeeConfigTranslation } from './fee-config-translation.entity';

@Entity('fee_configs')
export class FeeConfig {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Fee code', example: 'VAT' })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @ApiProperty({
    description: 'Fee as a decimal fraction (0.08 = 8%)',
    example: 0.08,
  })
  @Column({ type: 'decimal', precision: 10, scale: 6 })
  value: number;

  @ApiProperty({ description: 'Whether this fee is active', example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ type: () => [FeeConfigTranslation], required: false })
  @OneToMany(
    () => FeeConfigTranslation,
    (translation) => translation.feeConfig,
    {
      cascade: true,
    },
  )
  translations?: FeeConfigTranslation[];
}

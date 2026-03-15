import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('provider_cost_records')
@Unique(['provider', 'periodStart', 'periodEnd'])
@Index('idx_provider_cost_records_provider_period', ['provider', 'periodStart'])
export class ProviderCostRecord {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'deepgram' })
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @ApiProperty()
  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @ApiProperty()
  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @ApiProperty({ description: 'Provider-specific raw metrics (JSONB)' })
  @Column({ name: 'raw_metrics', type: 'jsonb' })
  rawMetrics: Record<string, number>;

  @ApiProperty({ description: 'Computed cost in USD' })
  @Column({
    name: 'computed_cost_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
  })
  computedCostUsd: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;
}

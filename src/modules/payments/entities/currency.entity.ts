import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CurrencyTranslation } from './currency-translation.entity';

@Entity('currencies')
export class Currency {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'VND' })
  @Column({ type: 'varchar', length: 3, unique: true })
  code: string;

  @ApiProperty({ description: 'Currency name', example: 'Vietnamese Dong' })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @ApiProperty({ description: 'Currency symbol', example: '₫' })
  @Column({ type: 'varchar', length: 5 })
  symbol: string;

  @ApiProperty({
    description: 'Exchange rate multiplier to VND (VND=1, USD≈25500)',
    example: 25500,
  })
  @Column({
    name: 'rate_to_vnd',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 1,
  })
  rateToVnd: number;

  @ApiProperty({
    description: 'Whether this currency is active',
    example: true,
  })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ type: () => [CurrencyTranslation], required: false })
  @OneToMany(() => CurrencyTranslation, (translation) => translation.currency, {
    cascade: true,
  })
  translations?: CurrencyTranslation[];
}

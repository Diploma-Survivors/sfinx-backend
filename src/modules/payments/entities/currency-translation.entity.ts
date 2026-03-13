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
import { Currency } from './currency.entity';

@Entity('currency_translations')
@Unique('UQ_currency_translation_lang', ['currencyId', 'languageCode'])
export class CurrencyTranslation {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Related currency ID', example: 1 })
  @Column({ name: 'currency_id' })
  currencyId: number;

  @ApiProperty({ description: 'Language code (en, vi)', example: 'vi' })
  @Column({ name: 'language_code', type: 'varchar', length: 10 })
  languageCode: string;

  @ApiProperty({ description: 'Localized currency name', example: 'Đô la Mỹ' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ description: 'Localized currency symbol', example: '$' })
  @Column({ type: 'varchar', length: 5, nullable: true })
  symbol: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Currency, (currency) => currency.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'currency_id' })
  currency: Currency;
}

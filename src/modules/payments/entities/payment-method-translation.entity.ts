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
import { PaymentMethod } from './payment-method.entity';

@Entity('payment_method_translations')
export class PaymentMethodTranslation {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Related Payment Method ID' })
  @Column({ name: 'payment_method_id' })
  paymentMethodId: number;

  @ApiProperty({ description: 'Language code (e.g., en, vi)' })
  @Column({ name: 'language_code', length: 10 })
  languageCode: string;

  @ApiProperty({ description: 'Translated name' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: 'Translated description' })
  @Column('text', { nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(
    () => PaymentMethod,
    (paymentMethod) => paymentMethod.translations,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;
}

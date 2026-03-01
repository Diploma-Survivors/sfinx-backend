import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethodEnum } from '../enums/payment-method.enum';
import { PaymentMethodTranslation } from './payment-method-translation.entity';

@Entity('payment_methods')
export class PaymentMethod {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({
    description: 'Payment method enum value',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.VNPAY,
  })
  @Column({ type: 'enum', enum: PaymentMethodEnum, unique: true })
  method: PaymentMethodEnum;

  @ApiProperty({ description: 'Icon URL for frontend display', nullable: true })
  @Column({ name: 'icon_url', nullable: true })
  iconUrl: string;

  @ApiProperty({ description: 'Whether this method is active', example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => PaymentMethodTranslation,
    (translation) => translation.paymentMethod,
  )
  translations: PaymentMethodTranslation[];
}

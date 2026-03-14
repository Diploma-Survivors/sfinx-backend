import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../modules/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PaymentMethodEnum } from '../enums/payment-method.enum';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('payment_transactions')
export class PaymentTransaction {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Plan ID' })
  @Column({ name: 'plan_id' })
  planId: number;

  @ApiProperty({
    description: 'Final amount in VND (after fees, sent to VNPAY)',
    example: 323000,
  })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiProperty({
    description: 'Base price in VND (before fees)',
    example: 299000,
  })
  @Column({
    name: 'base_price_snapshot',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  basePriceSnapshot: number;

  @ApiProperty({
    description: 'Total fee percentage snapshot at payment time (e.g. 0.096)',
    example: 0.096,
  })
  @Column({
    name: 'total_fee_percentage',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: 0,
  })
  totalFeePercentage: number;

  @ApiProperty({ description: 'Currency code', example: 'VND' })
  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @ApiProperty({
    description: 'Final plan price snapshot in VND at payment creation',
    example: 323000,
    required: false,
  })
  @Column({
    name: 'plan_price_vnd',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  planPriceVnd: number | null;

  @ApiProperty({
    description: 'Final plan price snapshot in USD at payment creation',
    example: 12.67,
    required: false,
  })
  @Column({
    name: 'plan_price_usd',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  planPriceUsd: number | null;

  @ApiProperty({
    description: 'Amount paid by user to gateway in payment currency',
    example: 323000,
    required: false,
  })
  @Column({
    name: 'user_paid_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  userPaidAmount: number | null;

  @ApiProperty({
    description: 'Currency user paid with at gateway',
    example: 'VND',
    required: false,
  })
  @Column({
    name: 'user_paid_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  userPaidCurrency: string | null;

  @ApiProperty({
    description: 'Estimated amount system actually receives',
    example: 318155,
    required: false,
  })
  @Column({
    name: 'system_received_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  systemReceivedAmount: number | null;

  @ApiProperty({
    description: 'Currency of estimated received amount',
    example: 'VND',
    required: false,
  })
  @Column({
    name: 'system_received_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  systemReceivedCurrency: string | null;

  @ApiProperty({
    description: 'Estimated received amount normalized to VND',
    example: 318155,
    required: false,
  })
  @Column({
    name: 'system_received_amount_vnd',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  systemReceivedAmountVnd: number | null;

  @ApiProperty({
    description: 'Estimated received amount in USD',
    example: 12.48,
    required: false,
  })
  @Column({
    name: 'system_received_amount_usd',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  systemReceivedAmountUsd: number | null;

  @ApiProperty({ description: 'Payment provider', example: 'VNPAY' })
  @Column({
    length: 20,
    default: PaymentMethodEnum[PaymentMethodEnum.VNPAY],
  })
  provider: string;

  @ApiProperty({
    description: 'Transaction ID from provider',
    example: '123456',
  })
  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @ApiProperty({ description: 'Payment description', nullable: true })
  @Column({ nullable: true })
  description: string;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatus })
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({ description: 'Date of payment' })
  @Column({ name: 'payment_date', type: 'timestamptz', nullable: true })
  paymentDate: Date;

  // Relationships
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

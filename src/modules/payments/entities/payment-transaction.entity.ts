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

  @ApiProperty({ description: 'Amount in USD', example: 9.99 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({ description: 'Amount in VND', example: 250000 })
  @Column({ name: 'amount_vnd', type: 'decimal', precision: 15, scale: 2 })
  amountVnd: number;

  @ApiProperty({ description: 'Exchange rate used', example: 25400 })
  @Column({ name: 'exchange_rate', type: 'decimal', precision: 10, scale: 2 })
  exchangeRate: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  @Column({ length: 3, default: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Payment provider', example: 'VNPAY' })
  @Column({ length: 20, default: 'VNPAY' })
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

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
  @Column({ length: 3, default: 'VND' })
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

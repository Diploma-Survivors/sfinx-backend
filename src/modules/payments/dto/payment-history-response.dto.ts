import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/payment-transaction.entity';

export class PaymentHistoryResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: number;

  @ApiProperty({ description: 'Payment Amount' })
  amount: number;

  @ApiProperty({ description: 'Currency Code' })
  currency: string;

  @ApiProperty({ description: 'Payment Provider' })
  provider: string;

  @ApiProperty({ description: 'Payment Status', enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ description: 'Plan Name' })
  planName: string;

  @ApiProperty({ description: 'Payment Date' })
  paymentDate: Date;

  @ApiProperty({ description: 'Transaction Reference ID from Provider' })
  transactionId: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VnpayCallbackDto {
  @ApiProperty({
    description: 'Merchant Amount (multipled by 100)',
    example: '10000000',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_Amount?: string;

  @ApiProperty({ description: 'Bank Code', example: 'NCB', required: false })
  @IsOptional()
  @IsString()
  vnp_BankCode?: string;

  @ApiProperty({
    description: 'Bank Transaction Number',
    example: 'VNP13978396',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_BankTranNo?: string;

  @ApiProperty({ description: 'Card Type', example: 'ATM', required: false })
  @IsOptional()
  @IsString()
  vnp_CardType?: string;

  @ApiProperty({
    description: 'Order Info',
    example: 'Thanh toan don hang 123',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_OrderInfo?: string;

  @ApiProperty({
    description: 'Payment Date',
    example: '20251231100521',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_PayDate?: string;

  @ApiProperty({ description: 'Response Code (00=Success)', example: '00' })
  @IsString()
  vnp_ResponseCode: string;

  @ApiProperty({
    description: 'Terminal Code',
    example: 'TEST_TMN',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_TmnCode?: string;

  @ApiProperty({
    description: 'Transaction Reference (Order ID)',
    example: '123',
  })
  @IsString()
  vnp_TxnRef: string;

  @ApiProperty({
    description: 'VNPAY Transaction Number',
    example: '13978396',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_TransactionNo?: string;

  @ApiProperty({
    description: 'Transaction Status',
    example: '00',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_TransactionStatus?: string;

  @ApiProperty({
    description: 'Secure Hash',
    example: 'af487...',
    required: true,
  })
  @IsString()
  vnp_SecureHash: string;

  @ApiProperty({
    description: 'Secure Hash Type',
    example: 'SHA256',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_SecureHashType?: string;
}

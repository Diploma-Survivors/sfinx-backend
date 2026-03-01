import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { PaymentMethodEnum } from '../enums/payment-method.enum';

export class CreatePaymentDto {
  @ApiProperty({ description: 'ID of the subscription plan', example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  planId: number;

  @ApiProperty({
    description: 'Payment method/provider',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.VNPAY,
  })
  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum = PaymentMethodEnum.VNPAY;
}

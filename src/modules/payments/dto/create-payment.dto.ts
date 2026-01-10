import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: 'ID of the subscription plan', example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  planId: number;

  @ApiProperty({
    description: 'Bank code (optional)',
    example: 'NCB',
    required: false,
  })
  @IsOptional()
  @IsString()
  bankCode?: string;
}

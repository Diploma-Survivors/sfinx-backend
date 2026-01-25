import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { SubscriptionType } from '../entities/subscription-plan.entity';
import { TranslationDto } from './translation.dto';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ enum: SubscriptionType, example: SubscriptionType.MONTHLY })
  @IsEnum(SubscriptionType)
  @IsNotEmpty()
  type: SubscriptionType;

  @ApiProperty({ example: 9.99, description: 'Price in USD' })
  @IsNumber()
  @Min(0)
  priceUsd: number;

  @ApiProperty({ example: 1, description: 'Duration in months' })
  @IsInt()
  @Min(1)
  durationMonths: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    type: [TranslationDto], // Use class reference
    example: [
      {
        languageCode: 'en',
        name: 'Monthly Plan',
        description: 'Billed monthly',
      },
      {
        languageCode: 'vi',
        name: 'Gói Tháng',
        description: 'Thanh toán hàng tháng',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations: TranslationDto[];
}

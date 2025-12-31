import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { SubscriptionType } from '../entities/subscription-plan.entity';

@Exclude()
export class SubscriptionPlanDto {
  @Expose()
  @ApiProperty()
  id: number;

  @Expose()
  @ApiProperty({ enum: SubscriptionType })
  type: SubscriptionType;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  description: string;

  @Expose()
  @ApiProperty()
  priceUsd: number;

  @Expose()
  @ApiProperty()
  durationMonths: number;

  @Expose()
  @ApiProperty()
  isActive: boolean;
}

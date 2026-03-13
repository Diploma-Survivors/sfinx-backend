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
  @ApiProperty({
    description: 'Base price in VND (before fees)',
    example: 299000,
  })
  basePrice: number;

  @Expose()
  @ApiProperty({
    description: 'Final price per currency (fees included)',
    example: { VND: 323000, USD: 12.67 },
  })
  prices: Record<string, number>;

  @Expose()
  @ApiProperty()
  durationMonths: number;

  @Expose()
  @ApiProperty()
  isActive: boolean;

  @Expose()
  @ApiProperty()
  features: any[];
}

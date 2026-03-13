import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

export class CurrentPlanResponseDto {
  @ApiProperty({ description: 'Plan ID' })
  planId: number;

  @ApiProperty({ description: 'Plan Name' })
  name: string;

  @ApiProperty({ description: 'Plan Description' })
  description: string;

  @ApiProperty({ description: 'Base price in VND' })
  basePrice: number;

  @ApiProperty({
    description: 'Final price per currency (fees included)',
    example: { VND: 323000, USD: 12.67 },
  })
  prices: Record<string, number>;

  @ApiProperty({ description: 'Plan Type (MONTHLY/YEARLY)' })
  type: string;

  @ApiProperty({ description: 'Subscription Start Date', nullable: true })
  startDate: Date;

  @ApiProperty({ description: 'Subscription Expiry Date', nullable: true })
  expiresAt: Date;

  @ApiProperty({
    description: 'Days remaining until expiration',
    nullable: true,
  })
  daysRemaining: number;

  @ApiProperty({
    description: 'Subscription Status (ACTIVE/EXPIRED)',
    enum: SubscriptionStatus,
  })
  status: SubscriptionStatus;
}

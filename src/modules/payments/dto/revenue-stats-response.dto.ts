import { ApiProperty } from '@nestjs/swagger';

export class RevenueChartItemDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  amount: number;
}

export class SubscriptionPlanStatsDto {
  @ApiProperty()
  plan: string;

  @ApiProperty()
  count: number;
}

export class RevenueStatsResponseDto {
  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  activeSubscribers: number;

  @ApiProperty()
  churnRate: number;

  @ApiProperty({ type: [RevenueChartItemDto] })
  revenueByMonth: RevenueChartItemDto[];

  @ApiProperty({ type: [SubscriptionPlanStatsDto] })
  subscriptionsByPlan: SubscriptionPlanStatsDto[];
}

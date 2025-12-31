import { ApiProperty } from '@nestjs/swagger';

export class RevenueMetricsDto {
  @ApiProperty({ description: 'Total premium users (active subscriptions)' })
  totalPremiumUsers: number;

  @ApiProperty({ description: 'Premium conversion rate (percentage)' })
  premiumConversionRate: number;

  @ApiProperty({ description: 'Total revenue (USD)' })
  totalRevenue: number;

  @ApiProperty({ description: 'Revenue today (USD)' })
  revenueToday: number;

  @ApiProperty({ description: 'Revenue this week (USD)' })
  revenueThisWeek: number;

  @ApiProperty({ description: 'Revenue this month (USD)' })
  revenueThisMonth: number;

  @ApiProperty({ description: 'New premium subscriptions today' })
  newPremiumToday: number;

  @ApiProperty({ description: 'New premium subscriptions this week' })
  newPremiumThisWeek: number;

  @ApiProperty({ description: 'New premium subscriptions this month' })
  newPremiumThisMonth: number;

  @ApiProperty({ description: 'Average revenue per user (ARPU) in USD' })
  averageRevenuePerUser: number;
}

export class PlatformMetricsDto {
  @ApiProperty({ description: 'Total registered users' })
  totalUsers: number;

  @ApiProperty({ description: 'Active users in last 30 days' })
  activeUsers: number;

  @ApiProperty({ description: 'Total problems (all statuses)' })
  totalProblems: number;

  @ApiProperty({ description: 'Active/published problems' })
  activeProblems: number;

  @ApiProperty({ description: 'Total submissions across platform' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total contests (all statuses)' })
  totalContests: number;
}

export class GrowthMetricsDto {
  @ApiProperty({ description: 'New users registered today' })
  newUsersToday: number;

  @ApiProperty({ description: 'New users registered this week' })
  newUsersThisWeek: number;

  @ApiProperty({ description: 'New users registered this month' })
  newUsersThisMonth: number;

  @ApiProperty({ description: 'Submissions submitted today' })
  submissionsToday: number;

  @ApiProperty({ description: 'Submissions submitted this week' })
  submissionsThisWeek: number;
}

export class EngagementMetricsDto {
  @ApiProperty({ description: 'Daily active users (last 24h)' })
  dailyActiveUsers: number;

  @ApiProperty({ description: 'Weekly active users (last 7 days)' })
  weeklyActiveUsers: number;

  @ApiProperty({ description: 'Monthly active users (last 30 days)' })
  monthlyActiveUsers: number;

  @ApiProperty({ description: 'Average submissions per user' })
  avgSubmissionsPerUser: number;
}

export class PlatformStatisticsDto {
  @ApiProperty({
    description: 'Platform-wide metrics',
    type: PlatformMetricsDto,
  })
  platform: PlatformMetricsDto;

  @ApiProperty({ description: 'Growth metrics', type: GrowthMetricsDto })
  growth: GrowthMetricsDto;

  @ApiProperty({
    description: 'User engagement metrics',
    type: EngagementMetricsDto,
  })
  engagement: EngagementMetricsDto;

  @ApiProperty({
    description: 'Revenue and payment metrics',
    type: RevenueMetricsDto,
  })
  revenue: RevenueMetricsDto;
}

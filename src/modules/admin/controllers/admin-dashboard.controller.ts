import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../../common';
import { Action } from '../../rbac/casl';
import { PlatformStatisticsService } from '../services/platform-statistics.service';
import {
  PlatformStatisticsDto,
  TimeSeriesMetricsDto,
} from '../dto/platform-statistics.dto';
import { CaslGuard } from '../../auth/guards/casl.guard';

@ApiTags('Admin Dashboard')
@Controller('admin/dashboard')
@UseGuards(CaslGuard)
export class AdminDashboardController {
  constructor(
    private readonly platformStatisticsService: PlatformStatisticsService,
  ) {}

  @Get('statistics')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'Get platform-wide statistics',
    description:
      'Retrieve comprehensive platform metrics including users, problems, contests, submissions, growth, and engagement analytics for admin dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics retrieved successfully',
    type: PlatformStatisticsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPlatformStatistics(): Promise<PlatformStatisticsDto> {
    return this.platformStatisticsService.getPlatformStatistics();
  }

  @Get('time-series')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'Get time series data for charts',
    description:
      'Retrieve daily time series data including new users, submissions, active users, and revenue for charting purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'Time series data retrieved successfully',
    type: TimeSeriesMetricsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTimeSeriesMetrics(
    @Query('from') from?: Date,
    @Query('to') to?: Date,
  ): Promise<TimeSeriesMetricsDto> {
    return this.platformStatisticsService.getTimeSeriesMetrics(from, to);
  }
}

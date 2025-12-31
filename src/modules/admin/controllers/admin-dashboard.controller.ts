import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CheckPolicies } from '../../../common';
import { AdminAccessPolicy } from '../../rbac/casl';
import { PlatformStatisticsService } from '../services/platform-statistics.service';
import {
  PlatformStatisticsDto,
  TimeSeriesMetricsDto,
} from '../dto/platform-statistics.dto';

@ApiTags('Admin Dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class AdminDashboardController {
  constructor(
    private readonly platformStatisticsService: PlatformStatisticsService,
  ) {}

  @Get('statistics')
  @CheckPolicies(new AdminAccessPolicy())
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
  @CheckPolicies(new AdminAccessPolicy())
  @ApiOperation({
    summary: 'Get time series data for charts',
    description:
      'Retrieve daily time series data for the last 30 days including new users, submissions, active users, and revenue for charting purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'Time series data retrieved successfully',
    type: TimeSeriesMetricsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTimeSeriesMetrics(): Promise<TimeSeriesMetricsDto> {
    return this.platformStatisticsService.getTimeSeriesMetrics();
  }
}

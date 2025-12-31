import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CheckPolicies } from '../../../common';
import { AdminAccessPolicy } from '../../rbac/casl/policies/admin-access.policy';
import { PlatformStatisticsService } from '../services/platform-statistics.service';
import { PlatformStatisticsDto } from '../dto/platform-statistics.dto';

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
}

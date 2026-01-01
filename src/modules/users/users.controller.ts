import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  UserProgressService,
  UserStatisticsService,
} from '../submissions/services';
import { UserStatisticsDto } from '../submissions/dto/user-statistics.dto';
import { PaginationQueryDto } from '../../common';
import { ProgressStatus } from '../submissions/enums';
import { UsersService } from './users.service';
import { UserProfileResponseDto } from '../auth/dto/user-profile-response.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userStatisticsService: UserStatisticsService,
    private readonly userProgressService: UserProgressService,
  ) {}

  @Get('profile')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiQuery({ name: 'userId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserProfile(
    @Query('userId') userId: number,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.getUserProfile(userId);
  }

  @Get(':userId/stats')
  @ApiOperation({ summary: 'Get user problem & submission stats' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved',
    type: UserStatisticsDto,
  })
  async getUserStats(
    @Param('userId') userId: string,
  ): Promise<UserStatisticsDto> {
    return this.userStatisticsService.getUserStatistics(+userId);
  }

  @Get(':userId/activity-years')
  @ApiOperation({ summary: 'Get years with user activity' })
  async getActivityYears(@Param('userId') userId: string): Promise<number[]> {
    return this.userStatisticsService.getActivityYears(+userId);
  }

  @Get(':userId/activity-calendar')
  @ApiOperation({ summary: 'Get activity calendar for a year' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getActivityCalendar(
    @Param('userId') userId: string,
    @Query('year') year?: number,
  ) {
    return this.userStatisticsService.getActivityCalendar(
      +userId,
      year ? +year : undefined,
    );
  }

  @Get(':userId/recent-ac-problems')
  @ApiOperation({ summary: 'Get recent accepted problems' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Default 15',
  })
  async getRecentAcProblems(
    @Param('userId') userId: string,
    @Query('limit') limit = 15,
  ) {
    return this.userProgressService.getRecentSolvedProblems(+userId, +limit);
  }

  @Get(':userId/practice-history')
  @ApiOperation({ summary: 'Get practice history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ProgressStatus })
  async getPracticeHistory(
    @Param('userId') userId: string,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: ProgressStatus,
  ) {
    return this.userProgressService.getAllUserProgress(+userId, query, status);
  }
}

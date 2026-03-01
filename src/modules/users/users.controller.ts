import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { ProgressStatus } from '../submissions/enums';
import { UsersService } from './users.service';
import { ContestRatingLeaderboardEntryDto } from './dto/contest-rating-leaderboard.dto';
import { ContestHistoryQueryDto } from './dto/contest-history-query.dto';
import { ContestHistoryEntryDto } from './dto/contest-history.dto';
import { ContestRatingChartDto } from './dto/contest-rating-chart.dto';
import { UserProfileResponseDto } from '../auth/dto/user-profile-response.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GetPracticeHistoryDto } from '../submissions/dto/get-practice-history.dto';
import { Permission } from '../rbac/entities/permission.entity';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { CheckPolicies } from '../../common';
import { Action } from '../rbac/casl';
import { User } from '../auth/entities/user.entity';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { SystemUserStatisticsDto } from './dto/system-user-statistics.dto';
import { CaslGuard } from '../auth/guards/casl.guard';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userStatisticsService: UserStatisticsService,
    private readonly userProgressService: UserProgressService,
  ) {}

  @Get('profile')
  @UseGuards(OptionalJwtAuthGuard, CaslGuard)
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

  @Get('permissions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user permisison' })
  @ApiQuery({ name: 'userId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: [Permission],
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserPermission(
    @Query('userId') userId: number,
  ): Promise<Permission[]> {
    return this.usersService.getUserPermisison(userId);
  }

  @Get('public/search')
  @ApiOperation({ summary: 'Search public users globally' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Public users retrieved successfully',
    type: PaginatedResultDto,
  })
  async searchPublicUsers(
    @Query('q') query: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResultDto<User>> {
    return this.usersService.searchPublicUsers(query, +page, +limit);
  }

  @Get()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Read, User))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: PaginatedResultDto,
  })
  async findAll(
    @Query() query: GetUsersQueryDto,
  ): Promise<PaginatedResultDto<User>> {
    return this.usersService.findAll(query);
  }

  @Get('statistics')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Read, User))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get system-wide user statistics' })
  @ApiResponse({
    status: 200,
    description: 'System user statistics retrieved successfully',
    type: SystemUserStatisticsDto,
  })
  async getSystemStatistics(): Promise<SystemUserStatisticsDto> {
    return this.usersService.getSystemStatistics();
  }

  @Post(':userId/ban')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, User))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ban a user' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  async banUser(@Param('userId') userId: number): Promise<void> {
    return this.usersService.banUser(userId);
  }

  @Post(':userId/unban')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, User))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unban a user' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  async unbanUser(@Param('userId') userId: number): Promise<void> {
    return this.usersService.unbanUser(userId);
  }

  @Get('ranking/contest')
  @ApiOperation({ summary: 'Global contest ELO rating leaderboard' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Contest rating leaderboard retrieved',
  })
  async getContestRatingLeaderboard(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ): Promise<PaginatedResultDto<ContestRatingLeaderboardEntryDto>> {
    return this.usersService.getContestRatingLeaderboard(+page, +limit);
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

  @Get(':userId/contest-rating-chart')
  @ApiOperation({
    summary: 'Get contest rating chart data for user profile',
    description:
      'Returns all data needed to render the contest rating chart: full rating history (ordered chronologically for x-axis), current rating, global rank, total ranked users, contests attended, top percentage, peak and lowest ratings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contest rating chart data retrieved',
    type: ContestRatingChartDto,
  })
  async getContestRatingChart(
    @Param('userId') userId: string,
  ): Promise<ContestRatingChartDto> {
    return this.usersService.getContestRatingChart(+userId);
  }

  @Get(':userId/contest-history')
  @ApiOperation({
    summary: 'Get user contest rating history with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Contest history retrieved',
    type: PaginatedResultDto,
  })
  async getContestHistory(
    @Param('userId') userId: string,
    @Query() query: ContestHistoryQueryDto,
  ): Promise<PaginatedResultDto<ContestHistoryEntryDto>> {
    return this.usersService.getContestHistory(+userId, query);
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
    @Query() query: GetPracticeHistoryDto,
  ) {
    return this.userProgressService.getAllUserProgress(+userId, query);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiPaginatedResponse,
  CheckPolicies,
  GetUser,
  PaginatedResultDto,
} from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManageContestsPolicy } from '../../rbac/casl';
import { CreateSubmissionDto } from '../../submissions/dto/create-submission.dto';
import { FilterSubmissionDto } from '../../submissions/dto/filter-submission.dto';
import { SubmissionListResponseDto } from '../../submissions/dto/submission-response.dto';
import { CreateContestDto } from '../dto';
import { ContestStatisticsDto } from '../dto/contest-statistics.dto';
import { FilterContestDto } from '../dto';
import { UpdateContestDto } from '../dto';
import { ContestParticipant } from '../entities';
import { Contest } from '../entities';
import { ContestStatisticsService } from '../services/contest-statistics.service';
import { ContestSubmissionService } from '../services';
import { ContestService } from '../services';

@ApiTags('Contests')
@Controller('contests')
export class ContestController {
  constructor(
    private readonly contestService: ContestService,
    private readonly contestStatisticsService: ContestStatisticsService,
    private readonly contestSubmissionService: ContestSubmissionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all contests with filtering' })
  @ApiPaginatedResponse(Contest, 'Contests retrieved successfully')
  async getContests(
    @Query() filterDto: FilterContestDto,
  ): Promise<PaginatedResultDto<Contest>> {
    return this.contestService.getContests(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contest by ID' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 200, description: 'Contest retrieved', type: Contest })
  @ApiResponse({ status: 404, description: 'Contest not found' })
  async getContestById(@Param('id') id: string): Promise<Contest> {
    return this.contestService.getContestById(+id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get contest by slug' })
  @ApiParam({ name: 'slug', description: 'Contest slug', type: String })
  @ApiResponse({ status: 200, description: 'Contest retrieved', type: Contest })
  @ApiResponse({ status: 404, description: 'Contest not found' })
  async getContestBySlug(@Param('slug') slug: string): Promise<Contest> {
    return this.contestService.getContestBySlug(slug);
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new contest (Admin only)' })
  @ApiResponse({ status: 201, description: 'Contest created', type: Contest })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createContest(
    @Body() createContestDto: CreateContestDto,
    @GetUser() user: User,
  ): Promise<Contest> {
    return this.contestService.createContest(createContestDto, user.id);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update contest (Admin only)' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 200, description: 'Contest updated', type: Contest })
  @ApiResponse({ status: 404, description: 'Contest not found' })
  async updateContest(
    @Param('id') id: string,
    @Body() updateContestDto: UpdateContestDto,
  ): Promise<Contest> {
    return this.contestService.updateContest(+id, updateContestDto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contest (Admin only)' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 204, description: 'Contest deleted' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete running/ended contest',
  })
  async deleteContest(@Param('id') id: string): Promise<void> {
    return this.contestService.deleteContest(+id);
  }

  @Get(':id/statistics')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get contest statistics (Admin only)',
    description:
      'Get comprehensive statistics for a contest including submission counts, participant counts, and per-problem breakdown',
  })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Contest statistics retrieved successfully',
    type: ContestStatisticsDto,
  })
  @ApiResponse({ status: 404, description: 'Contest not found' })
  async getContestStatistics(
    @Param('id') id: string,
  ): Promise<ContestStatisticsDto> {
    return this.contestStatisticsService.getContestStatistics(+id);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register for a contest' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Registered successfully',
    type: ContestParticipant,
  })
  @ApiResponse({ status: 400, description: 'Registration not allowed' })
  @ApiResponse({ status: 409, description: 'Already registered' })
  async registerForContest(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<ContestParticipant> {
    return this.contestService.registerForContest(+id, user.id);
  }

  @Delete(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister from a contest' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 204, description: 'Unregistered successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot unregister after contest started',
  })
  async unregisterFromContest(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return this.contestService.unregisterFromContest(+id, user.id);
  }

  @Get(':id/my-submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my submissions for this contest' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiPaginatedResponse(
    SubmissionListResponseDto,
    'Submissions retrieved successfully',
  )
  async getMyContestSubmissions(
    @Param('id') id: string,
    @GetUser() user: User,
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    return this.contestSubmissionService.getUserContestSubmissions(
      +id,
      user.id,
      filterDto,
    );
  }

  @Throttle({ default: { limit: 6, ttl: 60 } })
  @Post(':id/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit solution during contest' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Submission created',
    schema: { properties: { submissionId: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: 'Submission not allowed' })
  @ApiResponse({ status: 403, description: 'Not registered for contest' })
  async submitForContest(
    @Param('id') id: string,
    @Body() createSubmissionDto: CreateSubmissionDto,
    @GetUser() user: User,
  ): Promise<{ submissionId: string; contestId: number }> {
    // Validate submission is allowed
    await this.contestSubmissionService.validateSubmission(
      +id,
      user.id,
      createSubmissionDto.problemId,
    );

    // Note: The actual submission creation is delegated to SubmissionsService
    // This endpoint just validates and returns context
    // The integration with SubmissionsService should be done in the caller
    return {
      submissionId: 'pending', // Placeholder - actual submission handled by SubmissionsService
      contestId: +id,
    };
  }

  @Post(':id/start')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Manually start a contest (Admin only)' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 200, description: 'Contest started', type: Contest })
  async startContest(@Param('id') id: string): Promise<Contest> {
    return this.contestService.startContest(+id);
  }

  @Post(':id/end')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Manually end a contest (Admin only)' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 200, description: 'Contest ended', type: Contest })
  async endContest(@Param('id') id: string): Promise<Contest> {
    return this.contestService.endContest(+id);
  }

  @Post(':id/cancel')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel a contest (Admin only)' })
  @ApiParam({ name: 'id', description: 'Contest ID', type: Number })
  @ApiResponse({ status: 200, description: 'Contest cancelled', type: Contest })
  async cancelContest(@Param('id') id: string): Promise<Contest> {
    return this.contestService.cancelContest(+id);
  }
}

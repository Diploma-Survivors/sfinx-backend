import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { interval, merge, Observable } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import {
  ApiPaginatedResponse,
  CheckPolicies,
  GetUser,
  PaginatedResultDto,
  SkipTransformResponse,
} from '../../common';
import { User } from '../auth/entities/user.entity';
import { CaslGuard } from '../auth/guards/casl.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ViewAllSubmissionsPolicy } from '../rbac/casl';
import { SUBMISSION_SSE } from './constants/submission.constants';
import { CreateSubmissionResponseDto } from './dto/create-submission-response.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilterSubmissionDto } from './dto/filter-submission.dto';
import {
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from './dto/submission-response.dto';
import { GetPracticeHistoryDto } from './dto/get-practice-history.dto';
import { UserPracticeHistoryDto } from './dto/user-practice-history.dto';
import { UserStatisticsDto } from './dto/user-statistics.dto';
import { UserProblemProgressDetailResponseDto } from './dto/user-problem-progress-detail-response.dto';
import { SubmissionEvent } from './enums';
import { MessageEvent, SubmissionSseService } from './services';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly submissionSseService: SubmissionSseService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({
    default: {
      limit: 10,
      ttl: 60000,
    },
  })
  @Post('run')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Run code for a problem' })
  @ApiResponse({
    status: 200,
    description: 'Code executed successfully',
    type: CreateSubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid submission' })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  async runCode(@Body() createSubmissionDto: CreateSubmissionDto) {
    return this.submissionsService.executeTestRun(createSubmissionDto);
  }

  @Throttle({
    default: {
      limit: 6,
      ttl: 60000,
    },
  })
  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit code for a problem' })
  @ApiResponse({
    status: 201,
    description: 'Code submitted successfully',
    type: CreateSubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid submission' })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  async submitForGrading(
    @Body() createSubmissionDto: CreateSubmissionDto,
    @GetUser() user: User,
    @Ip() ipAddress: string,
  ) {
    return this.submissionsService.submitForGrading(
      createSubmissionDto,
      user.id,
      ipAddress,
    );
  }

  @Get()
  @UseGuards(CaslGuard)
  @CheckPolicies(new ViewAllSubmissionsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all submissions (Admin only)' })
  @ApiPaginatedResponse(
    SubmissionListResponseDto,
    'Submissions retrieved successfully',
  )
  async getAllSubmissions(
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    return this.submissionsService.getSubmissions(filterDto);
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user submissions' })
  @ApiPaginatedResponse(
    SubmissionListResponseDto,
    'User submissions retrieved successfully',
  )
  async getUserSubmissions(
    @GetUser() user: User,
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    return this.submissionsService.getUserSubmissions(user.id, filterDto);
  }

  @Get('user/me/statistics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatisticsDto,
  })
  async getUserStatistics(@GetUser() user: User): Promise<UserStatisticsDto> {
    return this.submissionsService.getUserStatistics(user.id);
  }

  @Get('user/me/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user problem progress' })
  @ApiPaginatedResponse(
    UserPracticeHistoryDto,
    'User problem progress retrieved successfully',
  )
  async getUserAllProgress(
    @GetUser() user: User,
    @Query() query: GetPracticeHistoryDto,
  ): Promise<PaginatedResultDto<UserPracticeHistoryDto>> {
    return this.submissionsService.getUserAllProgress(user.id, query);
  }

  @Get('problem/:problemId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user progress for a specific problem' })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Problem progress retrieved successfully',
    type: UserProblemProgressDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No progress found' })
  async getUserProblemProgress(
    @Param('problemId') problemId: string,
    @GetUser() user: User,
  ): Promise<UserProblemProgressDetailResponseDto | null> {
    return this.submissionsService.getUserProblemProgress(user.id, +problemId);
  }

  @Get('problem/:problemId')
  @ApiOperation({
    summary: 'Get all submissions for a problem (public, limited info)',
  })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiPaginatedResponse(
    SubmissionListResponseDto,
    'Problem submissions retrieved successfully',
  )
  async getProblemSubmissions(
    @Param('problemId') problemId: string,
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    filterDto.problemId = +problemId;
    return this.submissionsService.getSubmissions(filterDto);
  }

  @Get('problem/:problemId/relevant')
  @ApiOperation({
    summary: 'Get relevant (similar) submissions for a problem',
  })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Relevant submissions retrieved successfully',
  })
  async getRelevantSubmissions(
    @Param('problemId') problemId: string,
    @Query('languageId') languageId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.submissionsService.getRelevantSubmissions(
      +problemId,
      languageId ? +languageId : undefined,
      limit ? +limit : 10,
    );
  }

  @Get('problem/:problemId/top-performers')
  @ApiOperation({ summary: 'Get top performers for a problem' })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Top performers retrieved successfully',
  })
  async getTopPerformers(
    @Param('problemId') problemId: string,
    @Query('limit') limit?: string,
  ) {
    return this.submissionsService.getTopPerformers(
      +problemId,
      limit ? +limit : 10,
    );
  }

  @Get(':id/performance-stats')
  @ApiOperation({ summary: 'Get performance statistics for a submission' })
  @ApiParam({ name: 'id', description: 'Submission ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Performance statistics retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Submission not found or not accepted',
  })
  async getPerformanceStats(@Param('id') id: string) {
    return this.submissionsService.getPerformanceStats(+id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get submission by ID (with source code for own submissions)',
  })
  @ApiParam({ name: 'id', description: 'Submission ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Submission retrieved successfully',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async getSubmissionById(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<SubmissionResponseDto> {
    // Users can only see their own submissions with source code
    return this.submissionsService.getSubmissionById(+id, user.id, true);
  }

  @SkipTransformResponse()
  @Sse(':id/stream')
  @ApiOperation({
    summary: 'Stream submission results via Server-Sent Events (SSE)',
  })
  @ApiParam({ name: 'id', description: 'Submission ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of submission results',
  })
  streamResults(@Param('id') submissionId: string): Observable<MessageEvent> {
    // Create ping stream to keep connection alive
    const ping$ = interval(
      this.configService.get<number>('submission.pingTime'),
    ).pipe(
      map(() => ({
        type: SubmissionEvent.PING,
        data: SUBMISSION_SSE.PING_DATA,
      })),
    );

    // Merge submission results with ping events
    return merge(this.submissionSseService.connect(submissionId), ping$).pipe(
      finalize(() => this.submissionSseService.cleanup(submissionId)),
    );
  }
}

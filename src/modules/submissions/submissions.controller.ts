import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
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
} from '../../common';
import { User } from '../auth/entities/user.entity';
import { CaslGuard } from '../auth/guards/casl.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ViewAllSubmissionsPolicy } from '../rbac/casl/policies';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilterSubmissionDto } from './dto/filter-submission.dto';
import { SubmissionResponseDto } from './dto/submission-response.dto';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionResponseDto } from './dto/create-submission-response.dto';

@ApiTags('Submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Throttle({
    default: {
      limit: 10,
      ttl: 60,
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
      ttl: 60,
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
    SubmissionResponseDto,
    'Submissions retrieved successfully',
  )
  async getAllSubmissions(
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionResponseDto>> {
    return this.submissionsService.getSubmissions(filterDto);
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user submissions' })
  @ApiPaginatedResponse(
    SubmissionResponseDto,
    'User submissions retrieved successfully',
  )
  async getUserSubmissions(
    @GetUser() user: User,
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionResponseDto>> {
    return this.submissionsService.getUserSubmissions(user.id, filterDto);
  }

  @Get('user/me/statistics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  async getUserStatistics(@GetUser() user: User) {
    return this.submissionsService.getUserStatistics(user.id);
  }

  @Get('user/me/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user problem progress' })
  @ApiResponse({
    status: 200,
    description: 'User problem progress retrieved successfully',
  })
  async getUserAllProgress(@GetUser() user: User) {
    return this.submissionsService.getUserAllProgress(user.id);
  }

  @Get('problem/:problemId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user progress for a specific problem' })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Problem progress retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'No progress found' })
  async getUserProblemProgress(
    @Param('problemId') problemId: string,
    @GetUser() user: User,
  ) {
    return this.submissionsService.getUserProblemProgress(user.id, +problemId);
  }

  @Get('problem/:problemId')
  @ApiOperation({
    summary: 'Get all submissions for a problem (public, limited info)',
  })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiPaginatedResponse(
    SubmissionResponseDto,
    'Problem submissions retrieved successfully',
  )
  async getProblemSubmissions(
    @Param('problemId') problemId: string,
    @Query() filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionResponseDto>> {
    filterDto.problemId = +problemId;
    return this.submissionsService.getSubmissions(filterDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get submission by ID' })
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
    // Users can only see their own submissions
    // TODO: Admins should be able to see all submissions
    return this.submissionsService.getSubmissionById(+id, user.id);
  }
}

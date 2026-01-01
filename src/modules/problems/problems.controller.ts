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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  ApiPaginatedResponse,
  CheckAbility,
  FileRequiredPipe,
  GetUser,
  PaginatedResultDto,
} from '../../common';
import { User } from '../auth/entities/user.entity';
import { CaslGuard } from '../auth/guards/casl.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Action } from '../rbac/casl';
import { CreateProblemDto } from './dto/create-problem.dto';
import { CreateSampleTestcaseDto } from './dto/create-sample-testcase.dto';
import { UploadTestcaseDto } from './dto/create-testcase.dto';
import { FilterProblemDto } from './dto/filter-problem.dto';
import { ProblemDetailDto } from './dto/problem-detail.dto';
import { ProblemListItemDto } from './dto/problem-list-item.dto';
import { ProblemStatisticsDto } from './dto/problem-statistics.dto';
import { TestcaseDownloadUrlDto } from './dto/testcase-download-url.dto';
import { TestcaseUploadResponseDto } from './dto/testcase-upload-response.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { Problem } from './entities/problem.entity';
import { SampleTestcase } from './entities/sample-testcase.entity';
import { FileInterceptor } from './interceptors/file.interceptor';
import { ProblemsService } from './problems.service';
import { ProblemStatisticsService } from './services/problem-statistics.service';
import { SampleTestcaseService, TestcaseFileService } from './services';

@ApiTags('Problems')
@Controller('problems')
export class ProblemsController {
  constructor(
    private readonly problemsService: ProblemsService,
    private readonly problemStatisticsService: ProblemStatisticsService,
    private readonly testcaseFileService: TestcaseFileService,
    private readonly sampleTestcaseService: SampleTestcaseService,
  ) {}

  @Post()
  @UseGuards(CaslGuard)
  @UseInterceptors(FileInterceptor())
  @CheckAbility({ action: Action.Create, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new problem (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Problem created successfully',
    type: Problem,
  })
  @ApiResponse({ status: 409, description: 'Problem already exists' })
  async createProblem(
    @Body() createProblemDto: CreateProblemDto,
    @UploadedFile(FileRequiredPipe) testcaseFile: Express.Multer.File,
    @GetUser() user: User,
  ): Promise<Problem> {
    return this.problemsService.createProblem(
      createProblemDto,
      testcaseFile,
      user.id,
    );
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get all problems with filtering and pagination',
    description:
      'Returns active problems by default. Authenticated admins with read_all permission can view all problems.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiPaginatedResponse(ProblemListItemDto, 'Problems retrieved successfully')
  async getProblems(
    @Query() filterDto: FilterProblemDto,
    @GetUser() user?: User,
  ): Promise<PaginatedResultDto<ProblemListItemDto>> {
    return this.problemsService.getProblems(filterDto, user);
  }

  @Get('random')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get random problems',
    description:
      'Returns random active problems by default. Authenticated admins with read_all permission can get random problems from all problems.',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    type: Number,
    description: 'Number of problems to return',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Random problems retrieved successfully',
    type: [Problem],
  })
  async getRandomProblems(
    @Query('count') count?: number,
    @GetUser() user?: User,
  ): Promise<Problem[]> {
    return this.problemsService.getRandomProblems(
      count ? Number(count) : 5,
      user,
    );
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get problem by slug',
    description:
      'Returns problem details. Premium problems require authentication and premium subscription.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'slug', description: 'Problem slug' })
  @ApiResponse({
    status: 200,
    description: 'Problem retrieved successfully',
    type: ProblemDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  @ApiResponse({
    status: 403,
    description: 'Premium subscription required to access this problem',
  })
  async getProblemBySlug(
    @Param('slug') slug: string,
    @GetUser() user?: User,
  ): Promise<ProblemDetailDto> {
    return this.problemsService.getProblemBySlug(slug, user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get problem by ID',
    description:
      'Returns problem details. Premium problems require authentication and premium subscription.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Problem retrieved successfully',
    type: ProblemDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  @ApiResponse({
    status: 403,
    description: 'Premium subscription required to access this problem',
  })
  async getProblemById(
    @Param('id') id: string,
    @GetUser() user?: User,
  ): Promise<ProblemDetailDto> {
    return this.problemsService.getProblemById(+id, user);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update problem (Admin only)' })
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Problem updated successfully',
    type: Problem,
  })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  async updateProblem(
    @Param('id') id: string,
    @Body() updateProblemDto: UpdateProblemDto,
    @GetUser() user: User,
  ): Promise<Problem> {
    return this.problemsService.updateProblem(+id, updateProblemDto, user.id);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Delete, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete problem (Admin only)' })
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiResponse({ status: 204, description: 'Problem deleted successfully' })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  async deleteProblem(@Param('id') id: string): Promise<void> {
    return this.problemsService.deleteProblem(+id);
  }

  @Get(':id/statistics')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.ReadAll, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get problem statistics (Admin only)',
    description:
      'Get comprehensive statistics for a problem including submission counts, acceptance rate, language breakdown, and status distribution',
  })
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiQuery({
    name: 'from',
    required: false,
    type: Date,
    description: 'Filter submissions from this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: Date,
    description: 'Filter submissions until this date (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Problem statistics retrieved successfully',
    type: ProblemStatisticsDto,
  })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  async getProblemStatistics(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ProblemStatisticsDto> {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.problemStatisticsService.getProblemStatistics(
      +id,
      fromDate,
      toDate,
    );
  }

  // ==================== TESTCASES ENDPOINTS ====================

  @Post('testcases/upload')
  @UseGuards(CaslGuard)
  @UseInterceptors(FileInterceptor())
  @CheckAbility({ action: Action.Create, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload testcase file for a problem (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Testcase file uploaded successfully',
    type: TestcaseUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Testcase file is required',
  })
  async uploadTestcaseFile(
    @Body() uploadTestcaseDto: UploadTestcaseDto,
    @UploadedFile(FileRequiredPipe) testcaseFile: Express.Multer.File,
  ): Promise<TestcaseUploadResponseDto> {
    const { problemId } = uploadTestcaseDto;
    return this.testcaseFileService.uploadTestcaseFile(testcaseFile, problemId);
  }

  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.ReadAll, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @Get(':id/testcases/download-url')
  @ApiOperation({
    summary: 'Get presigned URL for testcase file download (Admin only)',
    description:
      'Returns a presigned URL that allows direct download from S3 without overloading the backend',
  })
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    type: Number,
    description: 'URL expiration time in seconds (default: 3600)',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    type: TestcaseDownloadUrlDto,
  })
  async getTestcaseDownloadUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: number,
  ): Promise<TestcaseDownloadUrlDto> {
    const expires = expiresIn ? Number(expiresIn) : 3600;
    const url = await this.testcaseFileService.getTestcaseFileUrl(+id, expires);
    return { url, expiresIn: expires };
  }

  @Delete(':id/testcases')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Delete, subject: Problem })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete testcase file (Admin only)' })
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 204,
    description: 'Testcase file deleted successfully',
  })
  async deleteTestcaseFile(@Param('id') id: string): Promise<void> {
    return this.testcaseFileService.deleteTestcaseFile(+id);
  }

  // ==================== SAMPLE TESTCASES ENDPOINTS ====================

  @Post('samples')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Create, subject: SampleTestcase })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create sample testcase (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Sample testcase created successfully',
    type: SampleTestcase,
  })
  async createSampleTestcase(
    @Body() createSampleDto: CreateSampleTestcaseDto,
  ): Promise<SampleTestcase> {
    return this.sampleTestcaseService.createSampleTestcase(createSampleDto);
  }

  @Get(':id/samples')
  @ApiOperation({ summary: 'Get sample testcases for a problem' })
  @ApiParam({ name: 'id', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Sample testcases retrieved successfully',
    type: [SampleTestcase],
  })
  async getSampleTestcases(@Param('id') id: string): Promise<SampleTestcase[]> {
    return this.sampleTestcaseService.getSampleTestcases(+id);
  }

  @Delete('samples/:id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Delete, subject: SampleTestcase })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete sample testcase (Admin only)' })
  @ApiParam({ name: 'id', description: 'Sample testcase ID', type: Number })
  @ApiResponse({
    status: 204,
    description: 'Sample testcase deleted successfully',
  })
  async deleteSampleTestcase(@Param('id') id: string): Promise<void> {
    return this.sampleTestcaseService.deleteSampleTestcase(+id);
  }
}

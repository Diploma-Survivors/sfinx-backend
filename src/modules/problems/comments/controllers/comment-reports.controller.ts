import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CheckAbility, GetUser, PaginatedResultDto } from '../../../../common';
import { CaslGuard } from '../../../auth/guards/casl.guard';
import { Action } from '../../../rbac/casl/casl-ability.factory';
import { FilterCommentReportDto } from '../dto';
import { CommentReport } from '../entities';
import { CommentReportsService } from '../services';

/**
 * Comment Reports Controller (Admin Only)
 * Handles moderation of user-reported comments
 */
@ApiTags('Comment Reports (Admin)')
@Controller('admin/comments/reports')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class CommentReportsController {
  constructor(private readonly reportsService: CommentReportsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: CommentReport })
  @ApiOperation({
    summary: 'List all comment reports',
    description:
      'Retrieve a paginated list of comment reports with optional filtering by resolution status. ' +
      'Supports sorting by various fields including creation date, resolution status, and reason.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully with pagination metadata',
    type: PaginatedResultDto<CommentReport>,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions - requires admin or moderator role',
  })
  async getAllReports(
    @Query() query: FilterCommentReportDto,
  ): Promise<PaginatedResultDto<CommentReport>> {
    return this.reportsService.getReports(query);
  }

  @Get('comment/:commentId')
  @CheckAbility({ action: Action.Read, subject: CommentReport })
  @ApiOperation({
    summary: 'Get all reports for a specific comment',
    description:
      'Retrieve all reports submitted for a particular comment. ' +
      'Useful for reviewing the moderation history of a specific comment.',
  })
  @ApiParam({
    name: 'commentId',
    description: 'The ID of the comment to get reports for',
    type: Number,
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully',
    type: [CommentReport],
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions - requires admin or moderator role',
  })
  async getReportsByComment(
    @Param('commentId') commentId: string,
  ): Promise<CommentReport[]> {
    return this.reportsService.getReportsByComment(+commentId);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: CommentReport })
  @ApiOperation({
    summary: 'Get a specific report by ID',
    description:
      'Retrieve detailed information about a specific comment report, ' +
      'including the reported comment, reporter details, and resolution information.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the report',
    type: Number,
    example: 456,
  })
  @ApiResponse({
    status: 200,
    description: 'Report retrieved successfully',
    type: CommentReport,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions - requires admin or moderator role',
  })
  @ApiResponse({
    status: 404,
    description: 'Report not found with the specified ID',
  })
  async getReportById(@Param('id') id: string): Promise<CommentReport> {
    return this.reportsService.getReportById(+id);
  }

  @Patch(':id/resolve')
  @CheckAbility({ action: Action.Update, subject: CommentReport })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Resolve a comment report',
    description:
      'Mark a report as reviewed and resolved. This action records which admin resolved the report and when. ' +
      'Once resolved, the report cannot be resolved again.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the report to resolve',
    type: Number,
    example: 456,
  })
  @ApiResponse({
    status: 204,
    description: 'Report resolved successfully - no content returned',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions - requires admin or moderator role',
  })
  @ApiResponse({
    status: 404,
    description: 'Report not found with the specified ID',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - report has already been resolved',
  })
  async resolveReport(
    @Param('id') id: string,
    @GetUser('id') adminId: number,
  ): Promise<void> {
    return this.reportsService.resolveReport(+id, adminId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CheckAbility, GetUser, PaginatedResultDto } from '../../../../common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../auth/guards/optional-jwt-auth.guard';
import { CaslGuard } from '../../../auth/guards/casl.guard';
import { Action } from '../../../rbac/casl/casl-ability.factory';
import {
  ProblemCommentResponseDto,
  CreateCommentDto,
  FilterCommentDto,
  ReportCommentDto,
  UpdateCommentDto,
  VoteCommentDto,
  VoteResponseDto,
} from '../dto';
import { ProblemComment } from '../entities';
import { EmailVerifiedGuard } from '../guards';
import { ProblemCommentsService, CommentReportsService } from '../services';

@ApiTags('Problem Comments')
@Controller()
export class ProblemCommentsController {
  constructor(
    private readonly commentsService: ProblemCommentsService,
    private readonly reportsService: CommentReportsService,
  ) {}

  @Post('problems/:problemId/comments')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new comment on a problem',
    description:
      'Create a comment on a problem or reply to another comment. Email verification required.',
  })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Comment created successfully',
    type: ProblemCommentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  @ApiResponse({ status: 404, description: 'Parent comment not found' })
  async createComment(
    @Param('problemId') problemId: string,
    @Body() dto: CreateCommentDto,
    @GetUser('id') userId: number,
  ): Promise<ProblemCommentResponseDto> {
    dto.problemId = +problemId;
    return this.commentsService.createComment(userId, +problemId, dto);
  }

  @Get('problems/:problemId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get paginated comments for a problem',
    description:
      'Get comments for a specific problem with optional filtering by type and parent',
  })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Comments retrieved successfully',
    type: PaginatedResultDto<ProblemCommentResponseDto>,
  })
  @ApiBearerAuth('JWT-auth')
  async getComments(
    @Param('problemId') problemId: string,
    @Query() query: FilterCommentDto,
    @GetUser('id') userId?: number,
  ): Promise<PaginatedResultDto<ProblemCommentResponseDto>> {
    query.problemId = +problemId;
    return this.commentsService.getPaginatedComments(query, userId);
  }

  @Get('problems/:problemId/comments/tree')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get comment tree for a problem',
    description:
      'Get all comments for a problem organized in a nested tree structure',
  })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Comment tree retrieved successfully',
    type: [ProblemCommentResponseDto],
  })
  async getCommentTree(
    @Param('problemId') problemId: string,
    @GetUser('id') userId?: number,
  ): Promise<ProblemCommentResponseDto[]> {
    return this.commentsService.buildCommentTree(+problemId, userId);
  }

  @Get('problems/comments/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get problem comment by ID' })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Comment retrieved successfully',
    type: ProblemCommentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async getCommentById(
    @Param('id') id: string,
    @GetUser('id') userId?: number,
  ): Promise<ProblemCommentResponseDto> {
    return this.commentsService.getCommentById(+id, userId);
  }

  @Patch('problems/comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update a problem comment',
    description: 'Update your own comment content or type',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Comment updated successfully',
    type: ProblemCommentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the comment owner' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @GetUser('id') userId: number,
  ): Promise<ProblemCommentResponseDto> {
    return this.commentsService.updateComment(+id, userId, dto);
  }

  @Delete('problems/comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a problem comment',
    description: 'Soft delete your own comment (preserves tree structure)',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the comment owner' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteComment(
    @Param('id') id: string,
    @GetUser('id') userId: number,
  ): Promise<void> {
    return this.commentsService.deleteComment(+id, userId);
  }

  @Patch('problems/comments/:id/pin')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: ProblemComment })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Pin a problem comment (Admin/Moderator only)',
    description: 'Pin important comments to the top',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Comment pinned successfully',
    type: ProblemCommentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async pinComment(
    @Param('id') id: string,
  ): Promise<ProblemCommentResponseDto> {
    return this.commentsService.pinComment(+id);
  }

  @Patch('problems/comments/:id/unpin')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: ProblemComment })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Unpin a problem comment (Admin/Moderator only)',
    description: 'Remove pin from a comment',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Comment unpinned successfully',
    type: ProblemCommentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async unpinComment(
    @Param('id') id: string,
  ): Promise<ProblemCommentResponseDto> {
    return this.commentsService.unpinComment(+id);
  }

  @Post('problems/comments/:id/vote')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Vote on a problem comment',
    description: 'Upvote or downvote a comment. Email verification required.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully',
    type: VoteResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async voteComment(
    @Param('id') id: string,
    @Body() dto: VoteCommentDto,
    @GetUser('id') userId: number,
  ): Promise<VoteResponseDto> {
    return this.commentsService.voteProblemComment(+id, userId, dto.voteType);
  }

  @Delete('problems/comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove vote from a problem comment',
    description: 'Remove your upvote or downvote from a comment',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({ status: 204, description: 'Vote removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeVote(
    @Param('id') id: string,
    @GetUser('id') userId: number,
  ): Promise<void> {
    return this.commentsService.removeVote(+id, userId);
  }

  @Post('problems/comments/:id/report')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Report a problem comment',
    description:
      'Report inappropriate comment for moderation. Email verification required.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({ status: 204, description: 'Comment reported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 409, description: 'Already reported this comment' })
  async reportComment(
    @Param('id') id: string,
    @Body() dto: ReportCommentDto,
    @GetUser('id') userId: number,
  ): Promise<void> {
    return this.reportsService.reportComment(+id, userId, dto);
  }
}

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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/entities/user.entity';
import { SolutionCommentsService } from './services/solution-comments.service'; // Changed import path and service name
import {
  CreateSolutionCommentDto,
  SolutionCommentResponseDto,
  UpdateSolutionCommentDto,
} from './dto';
import { VoteCommentDto } from '../comments-base/dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Solution Comments')
@Controller('solutions')
export class SolutionCommentsController {
  constructor(
    private readonly solutionCommentsService: SolutionCommentsService,
  ) {} // Changed service name

  @Get(':solutionId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get comments for a solution' })
  @ApiParam({ name: 'solutionId', type: Number })
  @ApiBearerAuth('JWT-auth')
  async getComments(
    @Param('solutionId') solutionId: string,
    @GetUser() user?: User,
  ): Promise<SolutionCommentResponseDto[]> {
    const comments = await this.solutionCommentsService.getComments(
      +solutionId,
      user?.id,
    ); // Changed service call
    // Base service returns BaseCommentResponseDto which is compatible structure
    return comments as SolutionCommentResponseDto[];
  }

  @Post(':solutionId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a comment for a solution' }) // Changed summary
  @ApiParam({ name: 'solutionId', type: Number })
  async createComment(
    @Param('solutionId') solutionId: string,
    @Body() dto: CreateSolutionCommentDto,
    @GetUser() user: User,
  ): Promise<SolutionCommentResponseDto> {
    return this.solutionCommentsService.createComment(
      user.id,
      +solutionId,
      dto,
    ); // Changed service call and added cast
  }

  @Patch('comments/:id') // Changed from Put to Patch
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a comment' }) // Changed summary
  @ApiParam({ name: 'id', type: Number })
  async updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateSolutionCommentDto,
    @GetUser() user: User,
  ): Promise<SolutionCommentResponseDto> {
    return this.solutionCommentsService.updateComment(
      +id,
      user.id,
      dto,
    ) as Promise<SolutionCommentResponseDto>; // Changed service call and added cast
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete comment' })
  @ApiParam({ name: 'id', type: Number })
  async deleteComment(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return this.solutionCommentsService.deleteComment(+id, user.id);
  }

  @Post('comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Vote on comment' })
  @ApiParam({ name: 'id', type: Number })
  async voteComment(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() dto: VoteCommentDto,
  ): Promise<void> {
    return this.solutionCommentsService.voteComment(+id, user.id, dto.voteType);
  }

  @Delete('comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove vote from comment' })
  async unvoteComment(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return this.solutionCommentsService.unvoteComment(+id, user.id);
  }
}

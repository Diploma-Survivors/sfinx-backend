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
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/entities/user.entity';
import { SolutionsService } from './solutions.service';
import { CreateSolutionCommentDto } from './dto/create-solution-comment.dto';
import { UpdateSolutionCommentDto } from './dto/update-solution-comment.dto';
import { SolutionComment } from './entities/solution-comment.entity';

@ApiTags('Solution Comments')
@Controller('solutions')
export class SolutionCommentsController {
  constructor(private readonly solutionsService: SolutionsService) {}

  @Get(':solutionId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get comments for a solution' })
  @ApiParam({ name: 'solutionId', type: Number })
  async getComments(
    @Param('solutionId') solutionId: string,
    @GetUser() user?: User,
  ): Promise<SolutionComment[]> {
    return this.solutionsService.getComments(+solutionId, user?.id);
  }

  @Post(':solutionId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a comment' })
  @ApiParam({ name: 'solutionId', type: Number })
  async createComment(
    @Param('solutionId') solutionId: string,
    @Body() dto: CreateSolutionCommentDto,
    @GetUser() user: User,
  ): Promise<SolutionComment> {
    return this.solutionsService.createComment(user.id, +solutionId, dto);
  }

  @Put('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update comment' })
  @ApiParam({ name: 'id', type: Number })
  async updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateSolutionCommentDto,
    @GetUser() user: User,
  ): Promise<SolutionComment> {
    return this.solutionsService.updateComment(+id, user.id, dto);
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
    return this.solutionsService.deleteComment(+id, user.id);
  }

  @Post('comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Vote on comment' })
  @ApiParam({ name: 'id', type: Number })
  async voteComment(
    @Param('id') id: string,
    @Query('type') type: 'up_vote' | 'down_vote',
    @GetUser() user: User,
  ): Promise<void> {
    return this.solutionsService.voteComment(+id, user.id, type);
  }

  @Delete('comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove vote from comment' })
  async unvoteComment(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return this.solutionsService.unvoteComment(+id, user.id);
  }
}

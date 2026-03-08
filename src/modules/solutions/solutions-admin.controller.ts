import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies, GetUser } from '../../common';
import { User } from '../auth/entities/user.entity';
import { CaslGuard } from '../auth/guards/casl.guard';
import { Action } from '../rbac/casl';
import {
  CreateSolutionDto,
  SolutionCommentResponseDto,
  SolutionResponseDto,
} from './dto';
import { AdminUpdateSolutionDto } from './dto/update-solution.dto';
import { SolutionCommentsService } from './services/solution-comments.service';
import { SolutionsService } from './solutions.service';

@ApiTags('Admin - Solutions')
@Controller('admin/solutions')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class SolutionsAdminController {
  constructor(
    private readonly solutionsService: SolutionsService,
    private readonly solutionCommentsService: SolutionCommentsService,
  ) {}

  @Post()
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'Create an editorial solution (admin)',
    description: 'Creates a solution marked as official editorial.',
  })
  @ApiResponse({
    status: 201,
    description: 'Editorial solution created',
    type: SolutionResponseDto,
  })
  createEditorial(
    @Body() dto: CreateSolutionDto,
    @GetUser() user: User,
  ): Promise<SolutionResponseDto> {
    return this.solutionsService.adminCreate(user.id, dto);
  }

  @Put(':id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'Update any solution (admin)',
    description: 'Updates a solution regardless of ownership.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Solution updated',
    type: SolutionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Solution not found' })
  updateSolution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateSolutionDto,
  ): Promise<SolutionResponseDto> {
    return this.solutionsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force delete a solution (admin)',
    description: 'Permanently deletes a solution regardless of ownership.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Solution deleted' })
  @ApiResponse({ status: 404, description: 'Solution not found' })
  forceDeleteSolution(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.solutionsService.adminRemove(id);
  }

  @Delete('comments/:id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force delete a solution comment (admin)',
    description: 'Deletes a comment regardless of ownership.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  forceDeleteComment(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.solutionCommentsService.deleteComment(id, 0, true);
  }

  @Post('comments/:id/pin')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Pin a solution comment (admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: SolutionCommentResponseDto })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  pinComment(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SolutionCommentResponseDto> {
    return this.solutionCommentsService.pinComment(id);
  }

  @Delete('comments/:id/pin')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Unpin a solution comment (admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: SolutionCommentResponseDto })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  unpinComment(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SolutionCommentResponseDto> {
    return this.solutionCommentsService.unpinComment(id);
  }
}

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies, PaginatedResultDto } from '../../../common';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';
import { FilterPostDto } from '../dto';
import { Post as DiscussPost } from '../entities/post.entity';
import { DiscussCommentService } from '../services/discuss-comment.service';
import { DiscussService } from '../services/discuss.service';

@ApiTags('Admin - Discuss')
@Controller('admin/discuss')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class DiscussAdminController {
  constructor(
    private readonly discussService: DiscussService,
    private readonly discussCommentService: DiscussCommentService,
  ) {}

  @Get('posts')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'List all posts (admin)',
    description:
      'Returns all posts with optional filters. Pass showDeleted=true to include soft-deleted posts.',
  })
  @ApiQuery({ name: 'showDeleted', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: PaginatedResultDto })
  findAllAdmin(
    @Query() query: FilterPostDto,
    @Query('showDeleted') showDeleted?: string,
  ): Promise<PaginatedResultDto<DiscussPost>> {
    return this.discussService.findAllAdmin(query, showDeleted === 'true');
  }

  @Delete('posts/:id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force delete a post (admin)',
    description: 'Soft-deletes a post regardless of ownership.',
  })
  @ApiParam({ name: 'id', description: 'Post ID (UUID)', type: String })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  forceDeletePost(@Param('id') id: string): Promise<void> {
    return this.discussService.adminDeletePost(id);
  }

  @Delete('comments/:id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force delete a comment (admin)',
    description:
      'Deletes a comment and all its replies regardless of ownership.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID', type: Number })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  forceDeleteComment(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.discussCommentService.deleteComment(id, 0, true);
  }
}

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
import { GetUser, PaginatedResultDto } from '../../../common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import {
  CreatePostDto,
  FilterPostDto,
  FilterTagDto,
  UpdatePostDto,
  VotePostDto,
} from '../dto';
import { Post as DiscussPost } from '../entities/post.entity';
import { DiscussService } from '../services/discuss.service';

@ApiTags('Discuss')
@Controller('discuss')
export class DiscussController {
  constructor(private readonly discussService: DiscussService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new discuss post' })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
    type: DiscussPost,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPost(
    @Body() dto: CreatePostDto,
    @GetUser('id') userId: number,
  ): Promise<DiscussPost> {
    return this.discussService.createPost(userId, dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all discuss tags' })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
  })
  async getTags(@Query() query: FilterTagDto) {
    return this.discussService.findAllTags(query);
  }

  @Get('trending-topics')
  @ApiOperation({ summary: 'Get trending topics' })
  @ApiResponse({
    status: 200,
    description: 'Trending topics retrieved successfully',
  })
  async getTrendingTopics() {
    return this.discussService.getTrendingTopics();
  }

  @Get('getAll')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated discuss posts' })
  @ApiResponse({
    status: 200,
    description: 'Posts retrieved successfully',
    type: PaginatedResultDto<DiscussPost>,
  })
  async getPosts(
    @Query() query: FilterPostDto,
  ): Promise<PaginatedResultDto<DiscussPost>> {
    return this.discussService.findAll(query);
  }

  @Get(':idOrSlug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get discuss post by ID or Slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Post ID or Slug' })
  @ApiResponse({
    status: 200,
    description: 'Post retrieved successfully',
    type: DiscussPost,
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getPost(@Param('idOrSlug') idOrSlug: string): Promise<DiscussPost> {
    return this.discussService.findOne(idOrSlug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a discuss post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Post updated successfully',
    type: DiscussPost,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the post owner' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @GetUser('id') userId: number,
  ): Promise<DiscussPost> {
    return this.discussService.updatePost(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a discuss post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 204, description: 'Post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the post owner' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async deletePost(
    @Param('id') id: string,
    @GetUser('id') userId: number,
  ): Promise<void> {
    return this.discussService.deletePost(id, userId);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vote on a discuss post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Vote recorded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async votePost(
    @Param('id') postId: string,
    @Body() dto: VotePostDto,
    @GetUser('id') userId: number,
  ): Promise<{ upvoteCount: number; downvoteCount: number }> {
    return this.discussService.votePost(userId, postId, dto.voteType);
  }

  @Get(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user vote for a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Vote retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserVote(
    @Param('id') postId: string,
    @GetUser('id') userId: number,
  ) {
    const voteType = await this.discussService.getUserVoteForPost(
      userId,
      postId,
    );
    return { voteType };
  }

  @Delete(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove vote from a discuss post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 204, description: 'Vote removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async unvotePost(
    @Param('id') postId: string,
    @GetUser('id') userId: number,
  ): Promise<void> {
    return this.discussService.unvotePost(userId, postId);
  }
}

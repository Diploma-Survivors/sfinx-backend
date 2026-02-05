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
import { CreatePostDto, FilterPostDto, UpdatePostDto } from '../dto';
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

  @Get()
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
}

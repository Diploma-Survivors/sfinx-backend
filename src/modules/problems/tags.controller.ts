import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  CheckAbility,
  PaginatedResultDto,
  PaginationQueryDto,
} from '../../common';
import { CaslGuard } from '../auth/guards/casl.guard';
import { Action } from '../rbac/casl/casl-ability.factory';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';
import { TagService } from './services/tag.service';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all tags',
    description: 'Returns all available tags ordered by name',
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: [Tag],
  })
  async getAllTags(): Promise<Tag[]> {
    return this.tagService.findAll();
  }

  @Get('admin/list')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Read, subject: Tag })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get paginated tags (Admin only)',
    description: 'Returns paginated tags for admin management',
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: PaginatedResultDto<Tag>,
  })
  async getPaginatedTags(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResultDto<Tag>> {
    return this.tagService.findAllPaginated(query);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get tags by type' })
  @ApiParam({ name: 'type', description: 'Tag type', example: 'technique' })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: [Tag],
  })
  async getTagsByType(@Param('type') type: string): Promise<Tag[]> {
    return this.tagService.findByType(type);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get tag by slug' })
  @ApiParam({ name: 'slug', description: 'Tag slug', example: 'two-pointers' })
  @ApiResponse({
    status: 200,
    description: 'Tag retrieved successfully',
    type: Tag,
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async getTagBySlug(@Param('slug') slug: string): Promise<Tag> {
    return this.tagService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  @ApiParam({ name: 'id', description: 'Tag ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Tag retrieved successfully',
    type: Tag,
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async getTagById(@Param('id') id: string): Promise<Tag> {
    return this.tagService.findById(+id);
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Create, subject: Tag })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new tag (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Tag created successfully',
    type: Tag,
  })
  @ApiResponse({ status: 409, description: 'Tag with slug already exists' })
  async createTag(@Body() createTagDto: CreateTagDto): Promise<Tag> {
    return this.tagService.create(createTagDto);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: Tag })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a tag (Admin only)' })
  @ApiParam({ name: 'id', description: 'Tag ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Tag updated successfully',
    type: Tag,
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async updateTag(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<Tag> {
    return this.tagService.update(+id, updateTagDto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Delete, subject: Tag })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag (Admin only)' })
  @ApiParam({ name: 'id', description: 'Tag ID', type: Number })
  @ApiResponse({ status: 204, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async deleteTag(@Param('id') id: string): Promise<void> {
    return this.tagService.delete(+id);
  }
}

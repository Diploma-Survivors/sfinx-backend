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
import { CheckPolicies, PaginatedResultDto } from '../../../common';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';
import {
  CreateDiscussionTagDto,
  FilterTagDto,
  UpdateDiscussionTagDto,
} from '../dto';
import { DiscussTag } from '../entities/discuss-tag.entity';
import { DiscussTagService } from '../services/discuss-tag.service';

@ApiTags('Discuss Tags')
@Controller('discuss/tags')
export class DiscussTagsController {
  constructor(private readonly discussTagService: DiscussTagService) {}

  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new discuss tag (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Tag created successfully',
    type: DiscussTag,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTag(@Body() dto: CreateDiscussionTagDto): Promise<DiscussTag> {
    return this.discussTagService.createTag(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all discuss tags' })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: PaginatedResultDto<DiscussTag>,
  })
  async getTags(@Query() query: FilterTagDto) {
    return this.discussTagService.findAllTags(query);
  }

  @Patch(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a discuss tag (Admin only)' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: 200,
    description: 'Tag updated successfully',
    type: DiscussTag,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async updateTag(
    @Param('id') id: number,
    @Body() dto: UpdateDiscussionTagDto,
  ): Promise<DiscussTag> {
    return this.discussTagService.updateTag(id, dto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a discuss tag (Admin only)' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({ status: 204, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async deleteTag(@Param('id') id: number): Promise<void> {
    return this.discussTagService.deleteTag(id);
  }
}

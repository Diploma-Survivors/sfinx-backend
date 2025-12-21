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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CheckAbility } from '../../common';
import { CaslGuard } from '../auth/guards/casl.guard';
import { Action } from '../rbac/casl/casl-ability.factory';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { Topic } from './entities/topic.entity';
import { TopicService } from './services/topic.service';

@ApiTags('Topics')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicService: TopicService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active topics',
    description: 'Returns all active topics ordered by order index and name',
  })
  @ApiResponse({
    status: 200,
    description: 'Topics retrieved successfully',
    type: [Topic],
  })
  async getAllTopics(): Promise<Topic[]> {
    return this.topicService.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get topic by slug' })
  @ApiParam({ name: 'slug', description: 'Topic slug', example: 'array' })
  @ApiResponse({
    status: 200,
    description: 'Topic retrieved successfully',
    type: Topic,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicBySlug(@Param('slug') slug: string): Promise<Topic> {
    return this.topicService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get topic by ID' })
  @ApiParam({ name: 'id', description: 'Topic ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Topic retrieved successfully',
    type: Topic,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicById(@Param('id') id: string): Promise<Topic> {
    return this.topicService.findById(+id);
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Create, subject: Topic })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new topic (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Topic created successfully',
    type: Topic,
  })
  @ApiResponse({ status: 409, description: 'Topic with slug already exists' })
  async createTopic(@Body() createTopicDto: CreateTopicDto): Promise<Topic> {
    return this.topicService.create(createTopicDto);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: Topic })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a topic (Admin only)' })
  @ApiParam({ name: 'id', description: 'Topic ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Topic updated successfully',
    type: Topic,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async updateTopic(
    @Param('id') id: string,
    @Body() updateTopicDto: UpdateTopicDto,
  ): Promise<Topic> {
    return this.topicService.update(+id, updateTopicDto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Delete, subject: Topic })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a topic (Admin only)' })
  @ApiParam({ name: 'id', description: 'Topic ID', type: Number })
  @ApiResponse({ status: 204, description: 'Topic deleted successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async deleteTopic(@Param('id') id: string): Promise<void> {
    return this.topicService.delete(+id);
  }

  @Post(':id/toggle')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: Topic })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle topic active status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Topic ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Topic status toggled successfully',
    type: Topic,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async toggleTopicStatus(@Param('id') id: string): Promise<Topic> {
    return this.topicService.toggleActive(+id);
  }
}

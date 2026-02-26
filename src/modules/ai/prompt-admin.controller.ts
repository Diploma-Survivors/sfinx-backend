import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../common';
import { Action } from '../rbac/casl';
import { CaslGuard } from '../auth/guards/casl.guard';
import { CreatePromptConfigDto } from './dto/create-prompt-config.dto';
import { UpdatePromptConfigDto } from './dto/update-prompt-config.dto';
import { PromptConfig } from './entities/prompt-config.entity';
import { PromptConfigService } from './prompt-config.service';
import { PromptService, PromptStatus } from './prompt.service';

@ApiTags('Admin - Prompts')
@Controller('admin/prompts')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class PromptAdminController {
  constructor(
    private readonly promptConfigService: PromptConfigService,
    private readonly promptService: PromptService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'List all prompt configs with live cache status',
    description:
      'Returns every prompt config from the DB enriched with current Redis cache state and a direct Langfuse URL.',
  })
  @ApiResponse({ status: 200 })
  async list(): Promise<PromptStatus[]> {
    return this.promptService.getStatus();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Get a single prompt config by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: PromptConfig })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PromptConfig> {
    return this.promptConfigService.findOne(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Create a new prompt config' })
  @ApiResponse({ status: 201, type: PromptConfig })
  @ApiResponse({ status: 409, description: 'featureName already exists' })
  create(@Body() dto: CreatePromptConfigDto): Promise<PromptConfig> {
    return this.promptConfigService.create(dto);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({
    summary: 'Update a prompt config',
    description:
      'Changing langfusePromptName or langfuseLabel does NOT automatically invalidate the Redis cache — call DELETE cache/:featureName afterwards.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: PromptConfig })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'featureName already exists' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromptConfigDto,
  ): Promise<PromptConfig> {
    return this.promptConfigService.update(id, dto);
  }

  // ── Cache routes MUST be declared before /:id to avoid routing conflicts ──

  @Delete('cache')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Invalidate all prompt caches',
    description:
      'Clears every prompt from Redis. Each next request will re-fetch from Langfuse.',
  })
  @ApiResponse({ status: 204, description: 'All caches cleared' })
  async invalidateAll(): Promise<void> {
    await this.promptService.invalidateCache();
  }

  @Delete('cache/:featureName')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate cache for a specific feature' })
  @ApiParam({ name: 'featureName', type: String, example: 'interviewer' })
  @ApiResponse({ status: 204, description: 'Cache cleared' })
  @ApiResponse({ status: 404, description: 'Feature not found or inactive' })
  async invalidateOne(
    @Param('featureName') featureName: string,
  ): Promise<void> {
    await this.promptService.invalidateCache(featureName);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate a prompt config',
    description: 'Soft-delete: sets isActive = false. Row stays in the DB.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Deactivated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.promptConfigService.remove(id);
  }
}

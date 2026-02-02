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

import { ApiPaginatedResponse, CheckAbility } from 'src/common';
// PermissionsGuard removed as unused

import {
  CreateProgrammingLanguageDto,
  QueryProgrammingLanguageDto,
  ReorderProgrammingLanguageDto,
  UpdateProgrammingLanguageDto,
} from './dto';
import { ProgrammingLanguage } from './entities/programming-language.entity';
import { ProgrammingLanguageService } from './programming-language.service';
import { CaslGuard } from '../auth/guards/casl.guard';
import { Action } from '../rbac/casl/casl-ability.factory';

@ApiTags('Programming Languages')
@Controller('programming-languages')
export class ProgrammingLanguageController {
  constructor(
    private readonly programmingLanguageService: ProgrammingLanguageService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all programming languages',
    description:
      'Retrieve all programming languages with optional filtering and pagination',
  })
  @ApiPaginatedResponse(
    ProgrammingLanguage,
    'Programming languages retrieved successfully',
  )
  async findAll(@Query() query: QueryProgrammingLanguageDto) {
    return this.programmingLanguageService.findAll(query);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get all active programming languages',
    description:
      'Retrieve only active programming languages, ordered by display order',
  })
  @ApiResponse({
    status: 200,
    description: 'Active programming languages retrieved successfully',
    type: [ProgrammingLanguage],
  })
  async findAllActive() {
    const languages = await this.programmingLanguageService.findAllActive();
    return languages;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get programming language by ID',
    description: 'Retrieve a specific programming language by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Programming language ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Programming language found',
    type: ProgrammingLanguage,
  })
  @ApiResponse({
    status: 404,
    description: 'Programming language not found',
  })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const language = await this.programmingLanguageService.findById(id);
    return language;
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get programming language by slug',
    description:
      'Retrieve a specific programming language by its URL-friendly slug',
  })
  @ApiParam({
    name: 'slug',
    description: 'Programming language slug',
    type: String,
    example: 'python3',
  })
  @ApiResponse({
    status: 200,
    description: 'Programming language found',
    type: ProgrammingLanguage,
  })
  @ApiResponse({
    status: 404,
    description: 'Programming language not found',
  })
  async findBySlug(@Param('slug') slug: string) {
    const language = await this.programmingLanguageService.findBySlug(slug);
    return language;
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Create, subject: ProgrammingLanguage })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create programming language',
    description: 'Create a new programming language (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Programming language created successfully',
    type: ProgrammingLanguage,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'Programming language with same name or slug already exists',
  })
  async create(@Body() dto: CreateProgrammingLanguageDto) {
    const language = await this.programmingLanguageService.create(dto);
    return language;
  }

  @Patch('reorder')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: ProgrammingLanguage })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reorder programming languages',
    description: 'Update the order index of programming languages (Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Programming languages reordered successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async reorder(@Body() dto: ReorderProgrammingLanguageDto) {
    await this.programmingLanguageService.reorder(dto.ids);
  }

  @Patch(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: ProgrammingLanguage })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update programming language',
    description: 'Update an existing programming language (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Programming language ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Programming language updated successfully',
    type: ProgrammingLanguage,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Programming language not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Programming language with same name or slug already exists',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgrammingLanguageDto,
  ) {
    const language = await this.programmingLanguageService.update(id, dto);
    return language;
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Delete, subject: ProgrammingLanguage })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete programming language',
    description:
      'Soft delete a programming language by setting isActive to false (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Programming language ID',
    type: Number,
  })
  @ApiResponse({
    status: 204,
    description: 'Programming language deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Programming language not found',
  })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.programmingLanguageService.delete(id);
  }

  @Patch(':id/activate')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Activate, subject: ProgrammingLanguage })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Activate programming language',
    description: 'Set a programming language as active (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Programming language ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Programming language activated successfully',
    type: ProgrammingLanguage,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Programming language not found',
  })
  async activate(@Param('id', ParseIntPipe) id: number) {
    const language = await this.programmingLanguageService.activate(id);
    return language;
  }

  @Patch(':id/deactivate')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Deactivate, subject: ProgrammingLanguage })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Deactivate programming language',
    description: 'Set a programming language as inactive (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Programming language ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Programming language deactivated successfully',
    type: ProgrammingLanguage,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Programming language not found',
  })
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    const language = await this.programmingLanguageService.deactivate(id);
    return language;
  }
}

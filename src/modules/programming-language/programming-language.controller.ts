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

import { RequirePermissions } from 'src/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import {
  CreateProgrammingLanguageDto,
  QueryProgrammingLanguageDto,
  UpdateProgrammingLanguageDto,
} from './dto';
import { ProgrammingLanguage } from './entities/programming-language.entity';
import { ProgrammingLanguageService } from './programming-language.service';

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
  @ApiResponse({
    status: 200,
    description: 'Programming languages retrieved successfully',
    type: [ProgrammingLanguage],
  })
  async findAll(@Query() query: QueryProgrammingLanguageDto) {
    const result = await this.programmingLanguageService.findAll(query);
    return result;
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('language:create')
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

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('language:update')
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('language:delete')
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('language:activate')
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('language:deactivate')
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

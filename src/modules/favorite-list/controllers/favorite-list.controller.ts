import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateFavoriteListDto } from '../dto/create-favorite-list.dto';
import { UpdateFavoriteListDto } from '../dto/update-favorite-list.dto';
import { FavoriteList } from '../entities/favorite-list.entity';
import { FavoriteListService } from '../services/favorite-list.service';

@ApiTags('Favorite Lists')
@Controller('favorite-lists')
export class FavoriteListController {
  constructor(private readonly favoriteListService: FavoriteListService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new favorite list' })
  @ApiResponse({
    status: 201,
    description: 'List created successfully',
    type: FavoriteList,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Request() req,
    @Body() createFavoriteListDto: CreateFavoriteListDto,
  ): Promise<FavoriteList> {
    return this.favoriteListService.create(req.user.id, createFavoriteListDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all lists for current user' })
  @ApiResponse({
    status: 200,
    description: 'Lists retrieved successfully',
    type: [FavoriteList],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Request() req): Promise<FavoriteList[]> {
    return this.favoriteListService.findAllByUser(req.user.id);
  }

  @Get('public')
  @ApiOperation({ summary: 'Get all public lists' })
  @ApiResponse({
    status: 200,
    description: 'Public lists retrieved successfully',
    type: [FavoriteList],
  })
  findPublicLists(): Promise<FavoriteList[]> {
    return this.favoriteListService.findPublicLists();
  }

  @Get('user/:userId/public')
  @ApiOperation({ summary: "Get a user's public lists" })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: "User's public lists retrieved successfully",
    type: [FavoriteList],
  })
  findUserPublicLists(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<FavoriteList[]> {
    return this.favoriteListService.findUserPublicLists(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single list by ID' })
  @ApiParam({ name: 'id', description: 'List ID' })
  @ApiResponse({
    status: 200,
    description: 'List retrieved successfully',
    type: FavoriteList,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Private list' })
  @ApiResponse({ status: 404, description: 'List not found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<FavoriteList> {
    return this.favoriteListService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a list' })
  @ApiParam({ name: 'id', description: 'List ID' })
  @ApiResponse({
    status: 200,
    description: 'List updated successfully',
    type: FavoriteList,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not owner' })
  @ApiResponse({ status: 404, description: 'List not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() updateFavoriteListDto: UpdateFavoriteListDto,
  ): Promise<FavoriteList> {
    return this.favoriteListService.update(
      id,
      req.user.id,
      updateFavoriteListDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a list' })
  @ApiParam({ name: 'id', description: 'List ID' })
  @ApiResponse({ status: 200, description: 'List deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete default list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not owner' })
  @ApiResponse({ status: 404, description: 'List not found' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req): Promise<void> {
    return this.favoriteListService.remove(id, req.user.id);
  }

  @Post(':id/problems/:problemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a problem to a list' })
  @ApiParam({ name: 'id', description: 'List ID' })
  @ApiParam({ name: 'problemId', description: 'Problem ID' })
  @ApiResponse({
    status: 200,
    description: 'Problem added successfully',
    type: FavoriteList,
  })
  @ApiResponse({ status: 400, description: 'Problem already in list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not owner' })
  @ApiResponse({ status: 404, description: 'List or Problem not found' })
  addProblem(
    @Param('id', ParseIntPipe) id: number,
    @Param('problemId', ParseIntPipe) problemId: number,
    @Request() req,
  ): Promise<FavoriteList> {
    return this.favoriteListService.addProblem(id, problemId, req.user.id);
  }

  @Delete(':id/problems/:problemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a problem from a list' })
  @ApiParam({ name: 'id', description: 'List ID' })
  @ApiParam({ name: 'problemId', description: 'Problem ID' })
  @ApiResponse({
    status: 200,
    description: 'Problem removed successfully',
    type: FavoriteList,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not owner' })
  @ApiResponse({ status: 404, description: 'List not found' })
  removeProblem(
    @Param('id', ParseIntPipe) id: number,
    @Param('problemId', ParseIntPipe) problemId: number,
    @Request() req,
  ): Promise<FavoriteList> {
    return this.favoriteListService.removeProblem(id, problemId, req.user.id);
  }

  @Get(':id/problems')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all problems in a list' })
  @ApiParam({ name: 'id', description: 'List ID' })
  @ApiResponse({
    status: 200,
    description: 'Problems retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Private list' })
  @ApiResponse({ status: 404, description: 'List not found' })
  getProblems(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.favoriteListService.getProblems(id, req.user.id);
  }
}

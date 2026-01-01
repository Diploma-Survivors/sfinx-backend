import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import { GetUser, PaginatedResultDto } from '../../common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/entities/user.entity';
import { SolutionsService } from './solutions.service';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';
import { FilterSolutionDto } from './dto/filter-solution.dto';
import { SolutionResponseDto } from './dto/solution-response.dto';
import { VoteCommentDto } from '../comments-base/dto';

@ApiTags('Solutions')
@Controller('solutions')
export class SolutionsController {
  constructor(private readonly solutionsService: SolutionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a solution' })
  @ApiResponse({
    status: 201,
    description: 'Solution created',
    type: SolutionResponseDto,
  })
  async createSolution(
    @Body() dto: CreateSolutionDto,
    @GetUser() user: User,
  ): Promise<SolutionResponseDto> {
    return this.solutionsService.create(user.id, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get solutions list' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'List of solutions',
    type: PaginatedResultDto,
  })
  async getSolutions(
    @Query() query: FilterSolutionDto,
    @GetUser() user?: User,
  ): Promise<PaginatedResultDto<SolutionResponseDto>> {
    return this.solutionsService.findAll(query, user?.id);
  }

  @Get('user/:userId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get solutions by user' })
  @ApiParam({ name: 'userId', type: Number })
  async getUserSolutions(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResultDto<SolutionResponseDto>> {
    return this.solutionsService.findAllByUser(+userId, +page, +limit);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get solution detail' })
  @ApiParam({ name: 'id', type: Number })
  async getSolution(
    @Param('id') id: string,
    @GetUser() user?: User,
  ): Promise<SolutionResponseDto> {
    return this.solutionsService.findOne(+id, user?.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update solution' })
  async updateSolution(
    @Param('id') id: string,
    @Body() dto: UpdateSolutionDto,
    @GetUser() user: User,
  ): Promise<SolutionResponseDto> {
    return this.solutionsService.update(+id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete solution' })
  async deleteSolution(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return this.solutionsService.remove(+id, user.id);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Vote on solution' })
  async voteSolution(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() dto: VoteCommentDto,
  ): Promise<void> {
    return this.solutionsService.voteSolution(+id, user.id, dto.voteType);
  }

  @Delete(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove vote from solution' })
  async unvoteSolution(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return this.solutionsService.unvoteSolution(+id, user.id);
  }
}

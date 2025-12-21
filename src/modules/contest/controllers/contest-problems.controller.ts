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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies, GetUser } from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { ManageContestsPolicy } from '../../rbac/casl/policies';
import { AddContestProblemDto } from '../dto/add-contest-problem.dto';
import { ContestProblem } from '../entities/contest-problem.entity';
import { ContestService } from '../services/contest.service';

@ApiTags('Contest Problems')
@Controller('contests/:contestId/problems')
export class ContestProblemsController {
  constructor(private readonly contestService: ContestService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get contest problems (hidden until start for non-admins)',
  })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Problems retrieved',
    type: [ContestProblem],
  })
  async getContestProblems(
    @Param('contestId') contestId: string,
    @GetUser() user?: User,
  ): Promise<ContestProblem[]> {
    return this.contestService.getContestProblems(+contestId, user);
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add problem to contest (Admin only)' })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Problem added',
    type: ContestProblem,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify running/ended contest',
  })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  @ApiResponse({ status: 409, description: 'Problem already in contest' })
  async addProblem(
    @Param('contestId') contestId: string,
    @Body() dto: AddContestProblemDto,
  ): Promise<ContestProblem> {
    return this.contestService.addProblemToContest(+contestId, dto);
  }

  @Delete(':problemId')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove problem from contest (Admin only)' })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiParam({ name: 'problemId', description: 'Problem ID', type: Number })
  @ApiResponse({ status: 204, description: 'Problem removed' })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify running/ended contest',
  })
  @ApiResponse({ status: 404, description: 'Problem not found in contest' })
  async removeProblem(
    @Param('contestId') contestId: string,
    @Param('problemId') problemId: string,
  ): Promise<void> {
    return this.contestService.removeProblemFromContest(+contestId, +problemId);
  }

  @Put('reorder')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageContestsPolicy())
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reorder contest problems (Admin only)' })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        order: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of problem IDs in desired order',
          example: [3, 1, 2],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Problems reordered' })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify running/ended contest',
  })
  async reorderProblems(
    @Param('contestId') contestId: string,
    @Body('order') order: number[],
  ): Promise<void> {
    return this.contestService.reorderContestProblems(+contestId, order);
  }
}

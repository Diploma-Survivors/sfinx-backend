import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { ContestProblem } from '../entities/contest-problem.entity';
import { ContestService } from '../services';

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
}

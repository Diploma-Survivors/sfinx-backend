import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../../common';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';
import { CronRebuildRankingJob } from '../jobs/cron-rebuild-ranking.job';

@ApiTags('Admin - Rankings')
@Controller('admin/rankings')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class RankingAdminController {
  constructor(private readonly rebuildJob: CronRebuildRankingJob) {}

  @Post('rebuild')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rebuild both global rankings',
    description:
      'Force a full rebuild of the problem-based and contest-rating Redis ZSETs from the database. Equivalent to the nightly cron.',
  })
  @ApiResponse({ status: 200, description: 'Rebuild completed' })
  async rebuildAll(): Promise<{ rebuilt: string[]; durationMs: number }> {
    const start = Date.now();
    await Promise.all([
      this.rebuildJob.rebuildProblemRanking(),
      this.rebuildJob.rebuildContestRating(),
    ]);
    return {
      rebuilt: ['problems', 'contests'],
      durationMs: Date.now() - start,
    };
  }

  @Post('rebuild/problems')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rebuild problem-based global ranking',
    description:
      'Force a rebuild of the global:ranking Redis ZSET (problem solve score + recency tiebreak).',
  })
  @ApiResponse({ status: 200, description: 'Rebuild completed' })
  async rebuildProblems(): Promise<{ rebuilt: string[]; durationMs: number }> {
    const start = Date.now();
    await this.rebuildJob.rebuildProblemRanking();
    return { rebuilt: ['problems'], durationMs: Date.now() - start };
  }

  @Post('rebuild/contests')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rebuild contest ELO rating ranking',
    description:
      'Force a rebuild of the global:contest-rating Redis ZSET from user_statistics.',
  })
  @ApiResponse({ status: 200, description: 'Rebuild completed' })
  async rebuildContests(): Promise<{ rebuilt: string[]; durationMs: number }> {
    const start = Date.now();
    await this.rebuildJob.rebuildContestRating();
    return { rebuilt: ['contests'], durationMs: Date.now() - start };
  }
}

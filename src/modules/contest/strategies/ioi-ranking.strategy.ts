import { Injectable } from '@nestjs/common';
import { SortOrder } from '../../../common';
import { Contest } from '../entities/contest.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';
import { ContestProblem } from '../entities/contest-problem.entity';
import { RankingType } from '../enums/ranking-type.enum';
import {
  OrderByColumn,
  RankingStrategy,
} from '../interfaces/ranking-strategy.interface';
import { SystemConfigService } from '../../system-config/system-config.service';

@Injectable()
export class IoiRankingStrategy implements RankingStrategy {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  getRankingType(): RankingType {
    return RankingType.IOI;
  }

  /**
   * IOI-style score with time decay:
   * Score = BasePoints - (TimeTaken / Duration) × BasePoints × DecayRate
   */
  calculateScore(
    contest: Contest,
    problem: ContestProblem,
    submissionTime: Date,
  ): number {
    const baseScore = problem.points;
    const durationMinutes = contest.durationMinutes;

    if (durationMinutes <= 0 || baseScore <= 0) return baseScore;

    const decayRate = this.systemConfigService.getFloat(
      'CONTEST_DECAY_RATE',
      0,
    );
    const timeTakenMs = Math.max(
      0,
      submissionTime.getTime() - contest.startTime.getTime(),
    );
    const timeTakenMinutes = timeTakenMs / 60000;

    const decayFactor = (timeTakenMinutes / durationMinutes) * decayRate;
    const penalty = baseScore * Math.min(decayFactor, 1);

    return Math.round(Math.max(0, baseScore - penalty) * 100) / 100;
  }

  /**
   * IOI ordering: solved_count DESC → total_score DESC → finish_time ASC
   */
  buildOrderByColumns(): OrderByColumn[] {
    return [
      {
        column: 'solvedCount',
        sqlColumn: 'p.solved_count',
        order: SortOrder.DESC,
      },
      {
        column: 'totalScore',
        sqlColumn: 'p.total_score',
        order: SortOrder.DESC,
      },
      {
        column: 'finishTime',
        sqlColumn: 'p.finish_time',
        order: SortOrder.ASC,
      },
    ];
  }

  applySortComparator(a: ContestParticipant, b: ContestParticipant): number {
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    if (Number(b.totalScore) !== Number(a.totalScore))
      return Number(b.totalScore) - Number(a.totalScore);
    return a.finishTime - b.finishTime;
  }
}

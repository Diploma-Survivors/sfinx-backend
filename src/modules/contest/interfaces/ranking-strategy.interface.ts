import { SortOrder } from '../../../common';
import { Contest } from '../entities/contest.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';
import { ContestProblem } from '../entities/contest-problem.entity';
import { RankingType } from '../enums/ranking-type.enum';

export interface OrderByColumn {
  column: string;
  sqlColumn: string;
  order: SortOrder;
}

export interface RankingStrategy {
  getRankingType(): RankingType;

  calculateScore(
    contest: Contest,
    problem: ContestProblem,
    submissionTime: Date,
  ): number;

  buildOrderByColumns(): OrderByColumn[];

  applySortComparator(a: ContestParticipant, b: ContestParticipant): number;
}

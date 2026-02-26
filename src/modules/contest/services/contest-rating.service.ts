import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys, RedisService } from '../../redis';
import { UserStatistics } from '../../submissions/entities/user-statistics.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';
import { IParticipantRatingData } from '../interfaces';

const DEFAULT_RATING = 1500;
const BINARY_SEARCH_LO = 1;
const BINARY_SEARCH_HI = 8000;

@Injectable()
export class ContestRatingService {
  private readonly logger = new Logger(ContestRatingService.name);

  constructor(
    @InjectRepository(ContestParticipant)
    private readonly participantRepo: Repository<ContestParticipant>,
    @InjectRepository(UserStatistics)
    private readonly statsRepo: Repository<UserStatistics>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Calculate and apply Codeforces-style ELO rating changes for a contest.
   * Only participants who made at least one submission are rated.
   */
  async calculateAndApplyRatings(contestId: number): Promise<void> {
    this.logger.log(`Calculating ratings for contest ${contestId}`);

    // 1. Load all participants who actually submitted
    const participants = await this.participantRepo.find({
      where: { contestId },
    });

    const active = participants.filter((p) => p.totalSubmissions > 0);

    if (active.length < 2) {
      this.logger.log(
        `Contest ${contestId}: not enough active participants (${active.length}) to calculate ratings`,
      );
      return;
    }

    // 2. Sort by leaderboard order to assign ranks
    // Primary: solvedCount DESC, Secondary: totalScore DESC, Tiebreaker: finishTime ASC
    const sorted = [...active].sort((a, b) => {
      if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
      if (Number(b.totalScore) !== Number(a.totalScore))
        return Number(b.totalScore) - Number(a.totalScore);
      return a.finishTime - b.finishTime;
    });

    // 3. Load current ratings from user_statistics (default 1500 if not found)
    const userIds = sorted.map((p) => p.userId);
    const statsRows = await this.statsRepo
      .createQueryBuilder('us')
      .select(['us.userId', 'us.contestRating'])
      .where('us.userId IN (:...userIds)', { userIds })
      .getMany();

    const ratingMap = new Map<number, number>();
    for (const row of statsRows) {
      ratingMap.set(row.userId, row.contestRating);
    }

    // 4. Build rating data with DENSE_RANK
    const allRatings: number[] = [];
    const ratingData: IParticipantRatingData[] = [];

    let currentRank = 1;
    let i = 0;
    while (i < sorted.length) {
      // Find group of tied participants
      let j = i;
      while (j < sorted.length && this.isTied(sorted[i], sorted[j])) {
        j++;
      }
      // All from i..j-1 share the same rank
      for (let k = i; k < j; k++) {
        const rating = ratingMap.get(sorted[k].userId) ?? DEFAULT_RATING;
        allRatings.push(rating);
        ratingData.push({
          userId: sorted[k].userId,
          contestId,
          currentRating: rating,
          actualRank: currentRank,
          seed: 0,
          delta: 0,
        });
      }
      currentRank = j + 1;
      i = j;
    }

    const n = ratingData.length;

    // 5. Compute seed for each participant (expected rank)
    for (const entry of ratingData) {
      entry.seed = this.computeSeed(entry.currentRating, allRatings);
    }

    // 6. Compute initial delta via binary search
    for (const entry of ratingData) {
      const midRank = Math.sqrt(entry.actualRank * entry.seed);
      const targetRating = this.findTargetRating(midRank, allRatings);
      entry.delta = Math.floor((targetRating - entry.currentRating) / 2);
    }

    // 7. Normalize: total sum of deltas should not be positive
    const sum = ratingData.reduce((acc, e) => acc + e.delta, 0);
    if (sum > 0) {
      const adjustment = Math.ceil(sum / n);
      for (const entry of ratingData) {
        entry.delta -= adjustment;
      }
    }

    // 8. Apply changes and persist
    const updates: Array<{ userId: number; newRating: number }> = [];

    for (const entry of ratingData) {
      const newRating = Math.max(1, entry.currentRating + entry.delta);
      updates.push({ userId: entry.userId, newRating });
    }

    // Bulk update user_statistics
    await this.applyRatingUpdates(updates);

    // Bulk update contest_participants with rating snapshot
    const participantUpdates = ratingData.map((entry) => {
      const newRating = Math.max(1, entry.currentRating + entry.delta);
      return {
        userId: entry.userId,
        contestId: entry.contestId,
        ratingBefore: entry.currentRating,
        ratingAfter: newRating,
        ratingDelta: entry.delta,
        contestRank: entry.actualRank,
      };
    });
    await this.applyParticipantUpdates(participantUpdates);

    // Sync Redis ZSET
    await this.syncContestRatingRedis(updates);

    this.logger.log(
      `Contest ${contestId}: rated ${n} participants successfully`,
    );
  }

  /**
   * Compute the expected rank (seed) for a given rating among all participants.
   * seed = 1 + Σ P(q beats p) = 1 + Σ 1/(1 + 10^((r_p - r_q)/400))
   */
  private computeSeed(rating: number, allRatings: number[]): number {
    let seed = 1;
    for (const rq of allRatings) {
      seed += 1 / (1 + Math.pow(10, (rating - rq) / 400));
    }
    return seed;
  }

  /**
   * Find via binary search the rating R such that computeSeed(R) ≈ midRank.
   * seed is a decreasing function of R, so we binary search accordingly.
   */
  private findTargetRating(midRank: number, allRatings: number[]): number {
    let lo = BINARY_SEARCH_LO;
    let hi = BINARY_SEARCH_HI;

    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const s = this.computeSeed(mid, allRatings);
      if (s < midRank) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    return lo;
  }

  /**
   * Check if two sorted participants are tied (same leaderboard position)
   */
  private isTied(a: ContestParticipant, b: ContestParticipant): boolean {
    return (
      a.solvedCount === b.solvedCount &&
      Number(a.totalScore) === Number(b.totalScore) &&
      a.finishTime === b.finishTime
    );
  }

  /**
   * Bulk update contest_rating and contests_participated in user_statistics
   */
  private async applyRatingUpdates(
    updates: Array<{ userId: number; newRating: number }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    // Upsert: ensure stats row exists first, then update
    // We use raw query for efficient bulk update
    const cases = updates
      .map((u) => `WHEN "user_id" = ${u.userId} THEN ${u.newRating}`)
      .join(' ');
    const ids = updates.map((u) => u.userId).join(',');

    await this.statsRepo.query(
      `UPDATE "user_statistics"
       SET "contest_rating" = CASE ${cases} END,
           "contests_participated" = "contests_participated" + 1
       WHERE "user_id" IN (${ids})`,
    );
  }

  /**
   * Bulk update contest_participants with rating snapshot columns
   */
  private async applyParticipantUpdates(
    updates: Array<{
      userId: number;
      contestId: number;
      ratingBefore: number;
      ratingAfter: number;
      ratingDelta: number;
      contestRank: number;
    }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const beforeCases = updates
      .map((u) => `WHEN "user_id" = ${u.userId} THEN ${u.ratingBefore}`)
      .join(' ');
    const afterCases = updates
      .map((u) => `WHEN "user_id" = ${u.userId} THEN ${u.ratingAfter}`)
      .join(' ');
    const deltaCases = updates
      .map((u) => `WHEN "user_id" = ${u.userId} THEN ${u.ratingDelta}`)
      .join(' ');
    const rankCases = updates
      .map((u) => `WHEN "user_id" = ${u.userId} THEN ${u.contestRank}`)
      .join(' ');
    const ids = updates.map((u) => u.userId).join(',');
    const contestId = updates[0].contestId;

    await this.participantRepo.query(
      `UPDATE "contest_participants"
       SET "rating_before" = CASE ${beforeCases} END,
           "rating_after" = CASE ${afterCases} END,
           "rating_delta" = CASE ${deltaCases} END,
           "contest_rank" = CASE ${rankCases} END
       WHERE "contest_id" = ${contestId} AND "user_id" IN (${ids})`,
    );
  }

  /**
   * Sync the Redis contest rating sorted set.
   * Score is the raw ELO rating (higher = better rank).
   */
  private async syncContestRatingRedis(
    updates: Array<{ userId: number; newRating: number }>,
  ): Promise<void> {
    for (const { userId, newRating } of updates) {
      await this.redisService.zadd(
        CacheKeys.globalRanking.contestBased(),
        newRating,
        userId.toString(),
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { UserStatistics } from '../entities/user-statistics.entity';
import { CacheKeys, RedisService } from '../../redis';

@Injectable()
export class CronRebuildRankingJob {
  private readonly logger = new Logger(CronRebuildRankingJob.name);
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserStatistics)
    private readonly userStatisticsRepository: Repository<UserStatistics>,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron() {
    this.logger.log('Starting daily global ranking rebuild...');
    const startTime = Date.now();

    try {
      await Promise.all([
        this.rebuildProblemRanking(),
        this.rebuildContestRating(),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`Global ranking rebuild completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to rebuild global ranking', error);
    }
  }

  async rebuildProblemRanking(): Promise<void> {
    await this.redisService.del(CacheKeys.globalRanking.problemBased());

    let skip = 0;
    let processed = 0;
    const MAX_TIMESTAMP = 9999999999;

    while (true) {
      const users = await this.userRepository.find({
        relations: ['statistics'],
        where: { isActive: true },
        order: { id: 'ASC' },
        take: this.BATCH_SIZE,
        skip,
      });

      if (users.length === 0) break;

      for (const user of users) {
        const globalScore = user.statistics?.globalScore ?? 0;
        if (Number(globalScore) > 0) {
          const lastSolveTime = user.statistics?.lastSolveAt
            ? Math.floor(user.statistics.lastSolveAt.getTime() / 1000)
            : 0;
          const encodedScore =
            Number(globalScore) * 1e10 + (MAX_TIMESTAMP - lastSolveTime);
          await this.redisService.zadd(
            CacheKeys.globalRanking.problemBased(),
            encodedScore,
            user.id.toString(),
          );
        }
      }

      processed += users.length;
      skip += this.BATCH_SIZE;
      this.logger.debug(`Problem ranking: processed ${processed} users...`);
    }
  }

  async rebuildContestRating(): Promise<void> {
    await this.redisService.del(CacheKeys.globalRanking.contestBased());

    let skip = 0;
    let processed = 0;

    while (true) {
      const stats = await this.userStatisticsRepository.find({
        order: { userId: 'ASC' },
        take: this.BATCH_SIZE,
        skip,
      });

      if (stats.length === 0) break;

      for (const stat of stats) {
        // Only include users who have participated in at least one contest
        if (stat.contestsParticipated > 0) {
          await this.redisService.zadd(
            CacheKeys.globalRanking.contestBased(),
            stat.contestRating,
            stat.userId.toString(),
          );
        }
      }

      processed += stats.length;
      skip += this.BATCH_SIZE;
      this.logger.debug(`Contest rating: processed ${processed} users...`);
    }
  }
}

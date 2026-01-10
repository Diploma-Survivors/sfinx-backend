import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { RedisService } from '../../redis';

@Injectable()
export class CronRebuildRankingJob {
  private readonly logger = new Logger(CronRebuildRankingJob.name);
  private readonly GLOBAL_RANKING_KEY = 'global:ranking';
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron() {
    this.logger.log('Starting daily global ranking rebuild...');
    const startTime = Date.now();

    try {
      // 1. Clear existing key
      await this.redisService.del(this.GLOBAL_RANKING_KEY);

      // 2. Stream/Batch fetch users
      let skip = 0;
      let processed = 0;
      const MAX_TIMESTAMP = 9999999999;

      while (true) {
        const users = await this.userRepository.find({
          select: ['id', 'globalScore', 'lastSolveAt'],
          where: { isActive: true },
          order: { id: 'ASC' },
          take: this.BATCH_SIZE,
          skip: skip,
        });

        if (users.length === 0) break;

        for (const user of users) {
          // Only rank users with score > 0
          if (Number(user.globalScore) > 0) {
            const lastSolveTime = user.lastSolveAt
              ? Math.floor(user.lastSolveAt.getTime() / 1000)
              : 0;
            const encodedScore =
              Number(user.globalScore) * 1e10 + (MAX_TIMESTAMP - lastSolveTime);
            await this.redisService.zadd(
              this.GLOBAL_RANKING_KEY,
              encodedScore,
              user.id.toString(),
            );
          }
        }

        processed += users.length;
        skip += this.BATCH_SIZE;
        this.logger.debug(`Processed ${processed} users...`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Global ranking rebuild completed in ${duration}ms. Total users: ${processed}`,
      );
    } catch (error) {
      this.logger.error('Failed to rebuild global ranking', error);
    }
  }
}

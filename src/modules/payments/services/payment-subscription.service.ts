import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { PaymentConfig } from '../../../config';

@Injectable()
export class PaymentSubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(PaymentSubscriptionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const paymentConfig = this.configService.get<PaymentConfig>('payment');
    const cronSchedule = paymentConfig?.cronSchedule || '0 0 * * *';
    const cronEnabled = paymentConfig?.cronEnabled ?? false;

    if (!cronEnabled) {
      this.logger.log('Premium expiration cron job is DISABLED');
      return;
    }

    this.logger.log(
      `Premium expiration cron job initialized with schedule: ${cronSchedule}`,
    );
    this.logger.log('Current time: ' + new Date().toISOString());

    const job = new CronJob(cronSchedule, () => {
      void this.handleExpiredPremiumSubscriptions();
    });

    this.schedulerRegistry.addCronJob('premium-expiration-check', job);
    job.start();
  }

  async handleExpiredPremiumSubscriptions(): Promise<void> {
    this.logger.log('Running premium expiration check...');

    const result = await this.userRepo
      .createQueryBuilder()
      .update()
      .set({
        isPremium: false,
        premiumStartedAt: null,
        premiumExpiresAt: null,
      })
      .where('isPremium = :isPremium', { isPremium: true })
      .andWhere('premiumExpiresAt < :now', { now: new Date() })
      .returning(['id', 'username'])
      .execute();

    const affectedUsers = result.raw as Array<{ id: number; username: string }>;

    if (affectedUsers.length === 0) {
      this.logger.log('No expired premium subscriptions found.');
      return;
    }

    const userIds = affectedUsers.map((u) => u.id).join(', ');
    this.logger.log(
      `Successfully downgraded ${affectedUsers.length} users to free plan. IDs: [${userIds}]`,
    );
  }
}

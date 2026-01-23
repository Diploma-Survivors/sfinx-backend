import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { PaymentConfig } from '../../../config';
import { MailService } from '../../mail';

@Injectable()
export class PaymentSubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(PaymentSubscriptionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly mailService: MailService,
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
      void this.checkExpiringSubscriptions();
    });

    this.schedulerRegistry.addCronJob('premium-expiration-check', job);
    job.start();
  }

  /**
   * Check for subscriptions expiring in 3 days
   */
  async checkExpiringSubscriptions(): Promise<void> {
    this.logger.log('Running premium expiring warning check...');
    const now = new Date();

    const warningDays = this.configService.get<number>(
      'payment.warningDaysBefore',
      3,
    );
    const expiryStart = new Date(
      now.getTime() + warningDays * 24 * 60 * 60 * 1000,
    );
    expiryStart.setHours(0, 0, 0, 0);
    const expiryEnd = new Date(
      now.getTime() + (warningDays + 1) * 24 * 60 * 60 * 1000,
    );
    expiryEnd.setHours(0, 0, 0, 0);

    const BATCH_SIZE = this.configService.get<number>('payment.batchSize', 100);
    let lastId = 0;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
      const users = await this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('user.isPremium = :isPremium', { isPremium: true })
        .andWhere('user.premiumExpiresAt >= :start', { start: expiryStart })
        .andWhere('user.premiumExpiresAt < :end', { end: expiryEnd })
        .andWhere('user.id > :lastId', { lastId })
        .orderBy('user.id', 'ASC')
        .take(BATCH_SIZE)
        .getMany();

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.log(`Processing batch of ${users.length} users...`);

      for (const user of users) {
        try {
          // userLang unused variable removed
          const planName = 'Premium Plan';

          const expiryDate = user.premiumExpiresAt
            ? user.premiumExpiresAt.toISOString().split('T')[0]
            : 'Unknown';

          const frontendUrl =
            this.configService.get<string>('FRONTEND_URL') ||
            'http://localhost:3000';
          const renewPath = this.configService.get<string>(
            'payment.renewUrlPath',
            '/pricing',
          );
          const renewUrl = `${frontendUrl}${renewPath}`;

          await this.mailService.sendPremiumExpiringEmail(user.email, {
            name: user.fullName || user.username,
            planName: planName,
            expiryDate: expiryDate,
            renewUrl: renewUrl,
          });
        } catch (error) {
          this.logger.error(
            `Failed to send expiring email to user ${user.id}`,
            error,
          );
        }
        lastId = user.id;
      }
      totalProcessed += users.length;
    }

    if (totalProcessed === 0) {
      this.logger.log('No subscriptions expiring in 3 days found.');
    } else {
      this.logger.log(
        `Completed expiring subscription check. Total processed: ${totalProcessed}`,
      );
    }
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

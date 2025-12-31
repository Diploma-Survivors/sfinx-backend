import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Injectable()
export class PaymentSubscriptionService {
  private readonly logger = new Logger(PaymentSubscriptionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Cron(process.env.PAYMENT_CRON_SCHEDULE || '0 0 * * *')
  async handlePremiumExpiration() {
    this.logger.log('Running premium expiration check...');

    const now = new Date();

    // Find users who are premium but expired
    const expiredUsers = await this.userRepo.find({
      where: {
        isPremium: true,
        premiumExpiresAt: LessThan(now),
      },
    });

    if (expiredUsers.length === 0) {
      this.logger.log('No expired premium subscriptions found.');
      return;
    }

    this.logger.log(
      `Found ${expiredUsers.length} expired subscriptions. Downgrading...`,
    );

    for (const user of expiredUsers) {
      user.isPremium = false;
      // distinct from premiumExpiresAt, we might want to keep history,
      // but effectively they are not premium anymore.

      await this.userRepo.save(user);
      this.logger.log(`User ${user.id} downgraded to free plan.`);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { PAYMENT_CRON_SCHEDULE } from '../../../config';

@Injectable()
export class PaymentSubscriptionService {
  private readonly logger = new Logger(PaymentSubscriptionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Cron(PAYMENT_CRON_SCHEDULE)
  async handleExpiredPremiumSubscriptions(): Promise<void> {
    this.logger.log('Running premium expiration check...');

    const expiredUsers = await this.findExpiredPremiumUsers();

    if (expiredUsers.length === 0) {
      this.logger.log('No expired premium subscriptions found.');
      return;
    }

    this.logger.log(
      `Found ${expiredUsers.length} expired premium subscriptions.`,
    );

    await this.downgradeToPlan(expiredUsers);

    this.logger.log(
      `Successfully downgraded ${expiredUsers.length} users to free plan.`,
    );
  }

  private async findExpiredPremiumUsers(): Promise<User[]> {
    return this.userRepo.find({
      where: {
        isPremium: true,
        premiumExpiresAt: LessThan(new Date()),
      },
    });
  }

  private async downgradeToPlan(users: User[]): Promise<void> {
    const userIds = users.map((user) => user.id);

    await this.userRepo.update(userIds, {
      isPremium: false,
      premiumStartedAt: null,
      premiumExpiresAt: null,
    });

    this.logger.log(`Downgraded users: ${userIds.join(', ')}`);
  }
}

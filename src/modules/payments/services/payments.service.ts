import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import {
  PaymentStatus,
  PaymentTransaction,
} from '../entities/payment-transaction.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';
import { VnPayProvider } from '../providers/vnpay.provider';
import { ExchangeRateService } from './exchange-rate.service';
import { MailService } from '../../mail/mail.service';
import { Language } from '../../auth/enums';

import { PaymentHistoryResponseDto } from '../dto/payment-history-response.dto';
import { CurrentPlanResponseDto } from '../dto/current-plan-response.dto';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly exchangeRateService: ExchangeRateService,
    // Start with VNPAY as the default provider
    @Inject(VnPayProvider)
    private readonly paymentProvider: PaymentProvider,
    private readonly mailService: MailService,
  ) {}

  /**
   * Create a payment transaction and generate payment URL
   */
  async createPaymentUrl(
    user: User,
    planId: number,
    ipAddr: string,
    bankCode?: string,
  ): Promise<string> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Subscription plan not found or inactive');
    }

    // Get Exchange Rate
    const rate = await this.exchangeRateService.getExchangeRate();
    const amountVnd = Math.ceil(plan.priceUsd * rate);

    // Create Transaction
    const transaction = this.transactionRepo.create({
      user,
      plan,
      userId: user.id,
      planId: plan.id,
      amount: plan.priceUsd,
      amountVnd: amountVnd,
      exchangeRate: rate,
      currency: 'USD',
      provider: 'VNPAY',
      status: PaymentStatus.PENDING,
      description: `Payment for ${plan.type} subscription`,
    });

    await this.transactionRepo.save(transaction);

    // Generate URL
    return this.paymentProvider.createPaymentUrl(transaction, ipAddr, bankCode);
  }

  /**
   * Handle payment callback/IPN
   */
  async handlePaymentCallback(query: Record<string, any>): Promise<{
    success: boolean;
    redirectUrl?: string; // For frontend redirect handling
    message?: string;
  }> {
    const validation = await this.paymentProvider.verifyReturnUrl(query);

    if (!validation.transactionId) {
      this.logger.error('Callback missing transaction ID');
      return { success: false, message: 'Invalid callback data' };
    }

    const transactionId = parseInt(validation.transactionId); // VNPAY returns txnRef (our ID)
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
      relations: ['user', 'plan', 'plan.translations'],
    });

    if (!transaction) {
      this.logger.error(`Transaction not found: ${transactionId}`);
      return { success: false, message: 'Transaction not found' };
    }

    if (transaction.status === PaymentStatus.SUCCESS) {
      // Already processed
      return { success: true, message: 'Already processed' };
    }

    if (validation.isSuccess) {
      transaction.status = PaymentStatus.SUCCESS;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      transaction.transactionId = query['vnp_TransactionNo'] || ''; // Gateway's ID
      transaction.paymentDate = new Date();
      await this.transactionRepo.save(transaction);

      // Upgrade User
      await this.upgradeUser(transaction.user, transaction.plan);

      // Send Email
      try {
        const userLang = transaction.user.preferredLanguage || Language.EN;
        const planTranslation = transaction.plan.translations.find(
          (t) => t.languageCode === String(userLang),
        );
        // Fallback to English or the first translation if specific language not found
        const fallbackTranslation =
          transaction.plan.translations.find(
            (t) => t.languageCode === String(Language.EN),
          ) || transaction.plan.translations[0];

        const planName =
          planTranslation?.name ||
          fallbackTranslation?.name ||
          `Plan #${transaction.plan.id}`;

        await this.mailService.sendPaymentSuccessEmail(transaction.user.email, {
          name: transaction.user.fullName || transaction.user.username,
          planName: planName,
          amount: transaction.amount,
          currency: transaction.currency,
          transactionId: transaction.transactionId || String(transaction.id),
          paymentDate: transaction.paymentDate.toISOString().split('T')[0],
        });
      } catch (error) {
        this.logger.error('Failed to send payment success email', error);
      }

      this.logger.log(
        `Payment success for user ${transaction.userId}, plan ${transaction.planId}`,
      );
      return { success: true };
    } else {
      transaction.status = PaymentStatus.FAILED;
      transaction.description = `${transaction.description} - Failed: ${validation.message}`;
      await this.transactionRepo.save(transaction);

      this.logger.warn(
        `Payment failed for txn ${transactionId}: ${validation.message}`,
      );
      return { success: false, message: validation.message };
    }
  }

  private async upgradeUser(user: User, plan: SubscriptionPlan): Promise<void> {
    const now = new Date();
    let startDate = now;

    // If user is already premium and not expired, extend from expiry date
    if (
      user.isPremium &&
      user.premiumExpiresAt &&
      user.premiumExpiresAt > now
    ) {
      startDate = user.premiumExpiresAt;
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    user.isPremium = true;
    user.premiumStartedAt = user.premiumStartedAt || now; // Keep original start if extending
    user.premiumExpiresAt = endDate;

    await this.userRepo.save(user);
  }

  async getPaymentHistory(user: User): Promise<PaymentHistoryResponseDto[]> {
    const transactions = await this.transactionRepo.find({
      where: { userId: user.id },
      relations: ['plan', 'plan.translations'],
      order: { createdAt: 'DESC' },
    });

    const userLang = user.preferredLanguage || Language.EN;

    return transactions.map((tx) => {
      const planTranslation = tx.plan.translations.find(
        (t) => t.languageCode === String(userLang),
      );
      const fallbackTranslation =
        tx.plan.translations.find(
          (t) => t.languageCode === String(Language.EN),
        ) || tx.plan.translations[0];

      const planName =
        planTranslation?.name ||
        fallbackTranslation?.name ||
        `Plan #${tx.planId}`;

      return {
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        provider: tx.provider,
        status: tx.status,
        planName: planName,
        paymentDate: tx.paymentDate || tx.createdAt,
        transactionId: tx.transactionId,
      };
    });
  }

  /**
   * Get current plan for user
   */
  async getCurrentPlan(user: User): Promise<CurrentPlanResponseDto | null> {
    if (!user.isPremium) {
      return null;
    }

    // Find the latest successful transaction to identify the plan
    const lastTransaction = await this.transactionRepo.findOne({
      where: { userId: user.id, status: PaymentStatus.SUCCESS },
      order: { createdAt: 'DESC' },
      relations: ['plan', 'plan.translations'],
    });

    if (!lastTransaction) {
      return null;
    }

    const plan = lastTransaction.plan;
    const userLang = user.preferredLanguage || Language.EN;
    const planTranslation = plan.translations.find(
      (t) => t.languageCode === String(userLang),
    );
    const fallbackTranslation =
      plan.translations.find((t) => t.languageCode === String(Language.EN)) ||
      plan.translations[0];
    const planName =
      planTranslation?.name || fallbackTranslation?.name || `Plan #${plan.id}`;
    const planDesc =
      planTranslation?.description ||
      fallbackTranslation?.description ||
      'No description';

    const now = new Date();
    const expiresAt = user.premiumExpiresAt || now;
    const daysRemaining = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      planId: plan.id,
      name: planName,
      description: planDesc,
      price: plan.priceUsd,
      type: plan.type,
      startDate: user.premiumStartedAt || lastTransaction.createdAt,
      expiresAt: expiresAt,
      daysRemaining: daysRemaining,
      status:
        daysRemaining > 0
          ? SubscriptionStatus.ACTIVE
          : SubscriptionStatus.EXPIRED,
    };
  }
}

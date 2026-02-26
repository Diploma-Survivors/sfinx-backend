import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Language } from '../../auth/enums';
import { MailService } from '../../mail/mail.service';
import {
  PaymentStatus,
  PaymentTransaction,
} from '../entities/payment-transaction.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';
import { VnPayProvider } from '../providers/vnpay.provider';
import { ExchangeRateService } from './exchange-rate.service';

import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { CurrentPlanResponseDto } from '../dto/current-plan-response.dto';
import { PaymentHistoryResponseDto } from '../dto/payment-history-response.dto';
import { RevenueStatsQueryDto } from '../dto/revenue-stats-query.dto';
import {
  RevenueChartItemDto,
  RevenueStatsResponseDto,
  SubscriptionPlanStatsDto,
} from '../dto/revenue-stats-response.dto';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

export interface TotalRevenueResult {
  totalRevenue: string;
}

export interface ActiveSubscribersResult {
  count: string;
}

export interface PlanSalesResult {
  planId: number;
  count: string;
}

export interface RevenueChartResult {
  period: string;
  amount: string;
}

export interface ChurnRateResult {
  churn_count: string;
}

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
    private readonly notificationsService: NotificationsService,
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
      transaction.transactionId = (query['vnp_TransactionNo'] as string) || ''; // Gateway's ID
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

      await this.notificationsService.create({
        recipientId: transaction.user.id,
        type: NotificationType.SYSTEM,
        translations: [
          {
            languageCode: Language.EN,
            title: 'Payment Successful',
            content:
              'Your payment was successful. Enjoy your premium features!',
          },
          {
            languageCode: Language.VI,
            title: 'Thanh toán thành công',
            content:
              'Thanh toán của bạn đã thành công. Hãy tận hưởng các tính năng premium!',
          },
        ],
        link: '/settings?tab=billing',
      });

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

  /**
   * Get all transactions with filtering (Admin)
   */
  async getAllTransactions(
    filter: TransactionFilterDto,
    lang = Language.EN,
  ): Promise<{ data: any[]; meta: any }> {
    const query = this.transactionRepo
      .createQueryBuilder('pt')
      .leftJoinAndSelect('pt.user', 'u')
      .leftJoinAndSelect('pt.plan', 'p')
      .leftJoinAndSelect('p.translations', 'pt_trans')
      .orderBy('pt.createdAt', filter.sortOrder || 'DESC');

    if (filter.status) {
      query.andWhere('pt.status = :status', { status: filter.status });
    }

    if (filter.search) {
      query.andWhere(
        '(u.username ILIKE :search OR pt.transactionId ILIKE :search OR u.email ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter.startDate) {
      query.andWhere('pt.createdAt >= :startDate', {
        startDate: filter.startDate,
      });
    }

    if (filter.endDate) {
      query.andWhere('pt.createdAt <= :endDate', { endDate: filter.endDate });
    }

    const total = await query.getCount();
    const transactions = await query
      .skip(filter.skip)
      .take(filter.take)
      .getMany();

    const data = transactions.map((tx) => {
      // Find translation based on user lang
      const planName =
        tx.plan?.translations?.find((t) => t.languageCode === String(lang))
          ?.name || `Plan #${tx.planId}`;

      return {
        id: tx.id,
        transactionId: tx.transactionId,
        userId: tx.userId,
        username: tx.user?.username,
        planName: planName,
        amount: Number(tx.amount), // Ensure number
        amountVnd: Number(tx.amountVnd),
        currency: tx.currency,
        provider: tx.provider,
        status: tx.status,
        paymentDate: tx.paymentDate || tx.createdAt,
      };
    });

    return {
      data,
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.ceil(total / (filter.limit || 20)),
      },
    };
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats(
    query: RevenueStatsQueryDto,
    lang = Language.EN,
  ): Promise<RevenueStatsResponseDto> {
    const { startDate, groupBy = 'month' } = query;
    let { endDate } = query;

    // Ensure endDate includes the full day (23:59:59.999) if provided
    // This fixes the issue where transactions on the last day are excluded because the default time is 00:00:00
    if (endDate) {
      const d = new Date(endDate);
      d.setUTCHours(23, 59, 59, 999);
      endDate = d.toISOString();
    }

    const [
      totalRevenue,
      activeSubscribers,
      subscriptionsByPlan,
      revenueByMonth,
      churnRate,
    ] = await Promise.all([
      this.getTotalRevenue(startDate, endDate),
      this.getActiveSubscribers(startDate, endDate),
      this.getSubscriptionsByPlan(startDate, endDate, lang),
      this.getRevenueChart(startDate, endDate, groupBy),
      this.getChurnRate(startDate, endDate),
    ]);

    // Calculate previous period for growth metrics
    // Handle undefined dates by defaulting to last 30 days if not provided (matching typical default)
    // Or use the revenueByMonth range if available
    const effectiveEndDate = endDate ? new Date(endDate) : new Date();
    const effectiveStartDate = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));

    const duration = effectiveEndDate.getTime() - effectiveStartDate.getTime();

    // Previous period end is immediately before current start (minus 1ms to prevent overlap)
    const previousEndDate = new Date(effectiveStartDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - duration);

    const [previousTotalRevenue, previousActiveSubscribers] = await Promise.all(
      [
        this.getTotalRevenue(
          previousStartDate.toISOString(),
          previousEndDate.toISOString(),
        ),
        this.getActiveSubscribers(
          previousStartDate.toISOString(),
          previousEndDate.toISOString(),
        ),
      ],
    );

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const revenueGrowth = calculateGrowth(totalRevenue, previousTotalRevenue);
    const subscriberGrowth = calculateGrowth(
      activeSubscribers,
      previousActiveSubscribers,
    );

    return {
      totalRevenue,
      activeSubscribers,
      revenueGrowth,
      subscriberGrowth,
      churnRate,
      revenueByMonth,
      subscriptionsByPlan,
    };
  }

  private async getTotalRevenue(
    startDate?: string,
    endDate?: string,
  ): Promise<number> {
    const query = this.transactionRepo
      .createQueryBuilder('pt')
      .select('SUM(pt.amount)', 'totalRevenue')
      .where('pt.status = :status', { status: PaymentStatus.SUCCESS });

    if (startDate) {
      query.andWhere('pt.paymentDate >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('pt.paymentDate <= :endDate', { endDate });
    }

    const result = await query.getRawOne<TotalRevenueResult>();
    return Number(result?.totalRevenue || 0);
  }

  private async getActiveSubscribers(
    startDate?: string,
    endDate?: string,
  ): Promise<number> {
    // 2. Active Subscribers (In the selected period)
    const activeParams: any[] = [PaymentStatus.SUCCESS];
    let activeFilter = '';

    if (endDate) {
      activeFilter += ` AND (pt.payment_date <= $${activeParams.length + 1})`;
      activeParams.push(endDate);
    }

    // If startDate/endDate provided: Check overlap.
    // If NOT provided: Check "Currently Active" (expiry >= NOW)
    if (startDate) {
      activeFilter += ` AND ((pt.payment_date + (p.duration_months || ' months')::interval) >= $${activeParams.length + 1})`;
      activeParams.push(startDate);
    } else if (!endDate) {
      // No range provided = Default to "Active NOW"
      activeFilter += ` AND ((pt.payment_date + (p.duration_months || ' months')::interval) >= NOW())`;
    }

    const activeRawQuery = `
      SELECT COUNT(DISTINCT pt.user_id) as count
      FROM payment_transactions pt
      LEFT JOIN subscription_plans p ON pt.plan_id = p.id
      WHERE pt.status = $1 ${activeFilter}
    `;

    const activeResult = (await this.transactionRepo.query(
      activeRawQuery,
      activeParams,
    )) as unknown as ActiveSubscribersResult[];
    return Number(activeResult[0]?.count || 0);
  }

  private async getSubscriptionsByPlan(
    startDate?: string,
    endDate?: string,
    lang = Language.EN,
  ): Promise<SubscriptionPlanStatsDto[]> {
    const salesByPlanQuery = this.transactionRepo
      .createQueryBuilder('pt')
      .select('pt.planId', 'planId')
      .addSelect('COUNT(pt.id)', 'count')
      .where('pt.status = :status', { status: PaymentStatus.SUCCESS })
      .groupBy('pt.planId');

    if (startDate) {
      salesByPlanQuery.andWhere('pt.paymentDate >= :startDate', { startDate });
    }
    if (endDate) {
      salesByPlanQuery.andWhere('pt.paymentDate <= :endDate', { endDate });
    }

    const salesByPlanId = await salesByPlanQuery.getRawMany<PlanSalesResult>();
    const plans = await this.planRepo.find({ relations: ['translations'] });

    return salesByPlanId.map((item) => {
      const planId = Number(item.planId);
      const plan = plans.find((p) => p.id === planId);
      const planTranslation =
        plan?.translations.find((t) => t.languageCode === String(lang)) ||
        plan?.translations.find(
          (t) => t.languageCode === String(Language.EN),
        ) ||
        plan?.translations[0];

      return {
        plan: planTranslation?.name || plan?.type || `Plan #${planId}`,
        count: Number(item.count),
      };
    });
  }

  private async getRevenueChart(
    startDate?: string,
    endDate?: string,
    groupBy: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<RevenueChartItemDto[]> {
    let chartStartDate = startDate ? new Date(startDate) : new Date(0);
    if (!startDate && !endDate) {
      chartStartDate = new Date();
      chartStartDate.setFullYear(chartStartDate.getFullYear() - 1);
    }
    const chartEndDate = endDate ? new Date(endDate) : new Date();
    if (endDate) {
      // Ensure we include the full end date (until 23:59:59.999)
      chartEndDate.setUTCHours(23, 59, 59, 999);
    }

    let dateFormat = 'YYYY-MM'; // Default month
    if (groupBy === 'day') {
      dateFormat = 'YYYY-MM-DD';
    } else if (groupBy === 'week') {
      dateFormat = 'YYYY-IW'; // ISO Week
    } else if (groupBy === 'year') {
      dateFormat = 'YYYY';
    }

    const revenueByPeriod = await this.transactionRepo
      .createQueryBuilder('pt')
      .select(
        `TO_CHAR(pt.paymentDate AT TIME ZONE 'UTC', '${dateFormat}')`,
        'period',
      )
      .addSelect('SUM(pt.amount)', 'amount')
      .where('pt.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('pt.paymentDate >= :chartStartDate', { chartStartDate })
      .andWhere('pt.paymentDate <= :chartEndDate', { chartEndDate })
      .groupBy(`TO_CHAR(pt.paymentDate AT TIME ZONE 'UTC', '${dateFormat}')`)
      .orderBy(
        `TO_CHAR(pt.paymentDate AT TIME ZONE 'UTC', '${dateFormat}')`,
        'ASC',
      )
      .getRawMany<RevenueChartResult>();

    // Fill missing periods
    const filledData: RevenueChartItemDto[] = [];
    const currentDate = new Date(chartStartDate);
    const end = new Date(chartEndDate);

    // Ensure we handle timezones correctly by just comparing date parts or iterating safely
    // A simple way is to iterate until we pass the end date
    // Clone loop start date
    const loopDate = new Date(currentDate);

    while (loopDate <= end) {
      let periodKey = '';
      if (groupBy === 'day') {
        // YYYY-MM-DD
        const yyyy = loopDate.getUTCFullYear();
        const mm = (loopDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const dd = loopDate.getUTCDate().toString().padStart(2, '0');
        periodKey = `${yyyy}-${mm}-${dd}`;

        loopDate.setUTCDate(loopDate.getUTCDate() + 1);
      } else if (groupBy === 'month') {
        // YYYY-MM
        const yyyy = loopDate.getUTCFullYear();
        const mm = (loopDate.getUTCMonth() + 1).toString().padStart(2, '0');
        periodKey = `${yyyy}-${mm}`;

        loopDate.setUTCMonth(loopDate.getUTCMonth() + 1);
      } else if (groupBy === 'year') {
        // YYYY
        periodKey = `${loopDate.getUTCFullYear()}`;

        loopDate.setUTCFullYear(loopDate.getUTCFullYear() + 1);
      } else {
        // Week - skip filling for now or handle ISO week later if needed
        // Just return as is for week to avoid complexity without moment/date-fns
        return revenueByPeriod.map((r) => ({
          month: r.period,
          amount: Number(r.amount),
        }));
      }

      const match = revenueByPeriod.find((r) => r.period === periodKey);
      filledData.push({
        month: periodKey,
        amount: match ? Number(match.amount) : 0,
      });
    }

    return filledData;
  }

  private async getChurnRate(
    startDate?: string,
    endDate?: string,
  ): Promise<number> {
    const activeSubscribers = await this.getActiveSubscribers(
      startDate,
      endDate,
    );
    if (activeSubscribers === 0) return 0;

    const params: any[] = [PaymentStatus.SUCCESS];
    let dateFilter = '';

    if (startDate) {
      dateFilter += ` AND e.expiry_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    const cutoff = endDate ?? new Date();
    dateFilter += ` AND e.expiry_date <= $${params.length + 1}`;
    params.push(cutoff);

    // Churn Logic (Anti-Join / User-Level / Last Expiry):
    // 1. Find the LATEST expiration date per user in the window.
    // 2. Identify the DISTINCT user.
    // 3. LEFT JOIN for any NEWER transaction (win-back/renewal).
    // 4. Filter where NEWER is NULL (meaning no renewal found).
    // 5. AND check if user is currently NOT premium (double verify state).

    const churnQuery = `
    SELECT COUNT(DISTINCT e.user_id) AS churn_count
    FROM (
      SELECT
        pt.user_id,
        MAX(pt.payment_date + (p.duration_months * INTERVAL '1 month')) AS expiry_date
      FROM payment_transactions pt
      JOIN subscription_plans p ON p.id = pt.plan_id
      WHERE pt.status = $1
      GROUP BY pt.user_id
    ) e
    LEFT JOIN payment_transactions newer
      ON newer.user_id = e.user_id
     AND newer.payment_date > e.expiry_date
     AND newer.status = $1
    JOIN users u ON u.id = e.user_id
    WHERE
      newer.id IS NULL
      AND u.is_premium = false
      ${dateFilter}
    `;

    const result = (await this.transactionRepo.query(
      churnQuery,
      params,
    )) as unknown as ChurnRateResult[];
    const churnedUsers = Number(result[0]?.churn_count || 0);

    return Number(((churnedUsers / activeSubscribers) * 100).toFixed(2));
  }
}

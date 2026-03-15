import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { Contest } from '../../contest/entities';
import { Submission } from '../../submissions/entities/submission.entity';
import {
  PaymentTransaction,
  PaymentStatus,
} from '../../payments/entities/payment-transaction.entity';
import { Cacheable } from '../../../common';
import { CACHE_TTL } from '../../../common';
import {
  PlatformStatisticsDto,
  PlatformMetricsDto,
  GrowthMetricsDto,
  EngagementMetricsDto,
  RevenueMetricsDto,
  TimeSeriesMetricsDto,
  TimeSeriesDataPointDto,
} from '../dto/platform-statistics.dto';
import { Language } from '../../auth/enums';
import { CurrencyCode } from '../../payments/enums/currency-code.enum';
import { CurrencyService } from '../../payments/services/currency.service';

const ACTIVE_USER_THRESHOLD_DAYS = 30;

@Injectable()
export class PlatformStatisticsService {
  private readonly logger = new Logger(PlatformStatisticsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(Contest)
    private readonly contestRepository: Repository<Contest>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    private readonly currencyService: CurrencyService,
  ) {}

  @Cacheable({
    key: (lang: unknown) => {
      const normalizedLang = (lang as Language) || Language.EN;
      return `platform:statistics:${normalizedLang}`;
    },
    ttl: CACHE_TTL.FIVE_MINUTES,
  })
  async getPlatformStatistics(lang?: Language): Promise<PlatformStatisticsDto> {
    this.logger.log('Fetching platform-wide statistics');

    const [platform, growth, engagement, revenue] = await Promise.all([
      this.getPlatformMetrics(),
      this.getGrowthMetrics(),
      this.getEngagementMetrics(),
      this.getRevenueMetrics(lang),
    ]);

    return {
      platform,
      growth,
      engagement,
      revenue,
    };
  }

  private async getPlatformMetrics(): Promise<PlatformMetricsDto> {
    const [
      totalUsers,
      activeUsers,
      totalProblems,
      activeProblems,
      totalSubmissions,
      totalContests,
    ] = await Promise.all([
      // Total non-banned users (consistent with other metrics)
      this.userRepository.count({ where: { isBanned: false } }),

      // Active users (active in calculated threshold)
      this.getActiveUsersCount(ACTIVE_USER_THRESHOLD_DAYS),

      // Total problems
      this.problemRepository.count(),

      // Active/published problems
      this.problemRepository.count({
        where: { isActive: true },
      }),

      // Total submissions
      this.submissionRepository.count(),

      // Total contests
      this.contestRepository.count(),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalProblems,
      activeProblems,
      totalSubmissions,
      totalContests,
    };
  }

  /**
   * Get active users count based on days threshold
   */
  private async getActiveUsersCount(days: number): Promise<number> {
    return this.userRepository
      .createQueryBuilder('user')
      .where(`user.lastActiveAt >= NOW() - INTERVAL '${days} days'`)
      .andWhere('user.isBanned = false')
      .getCount();
  }

  private async getGrowthMetrics(): Promise<GrowthMetricsDto> {
    const [
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      submissionsToday,
      submissionsThisWeek,
    ] = await Promise.all([
      // New users today
      this.userRepository
        .createQueryBuilder('user')
        .where('user.createdAt >= CURRENT_DATE')
        .andWhere('user.isBanned = false')
        .getCount(),

      // New users this week
      this.userRepository
        .createQueryBuilder('user')
        .where("user.createdAt >= NOW() - INTERVAL '7 days'")
        .andWhere('user.isBanned = false')
        .getCount(),

      // New users this month
      this.userRepository
        .createQueryBuilder('user')
        .where("user.createdAt >= NOW() - INTERVAL '30 days'")
        .andWhere('user.isBanned = false')
        .getCount(),

      // Submissions today
      this.submissionRepository
        .createQueryBuilder('submission')
        .where('submission.submittedAt >= CURRENT_DATE')
        .getCount(),

      // Submissions this week
      this.submissionRepository
        .createQueryBuilder('submission')
        .where("submission.submittedAt >= NOW() - INTERVAL '7 days'")
        .getCount(),
    ]);

    return {
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      submissionsToday,
      submissionsThisWeek,
    };
  }

  private async getEngagementMetrics(): Promise<EngagementMetricsDto> {
    const results = await Promise.all([
      // Daily active users (last 24 hours)
      this.userRepository
        .createQueryBuilder('user')
        .where("user.lastActiveAt >= NOW() - INTERVAL '24 hours'")
        .andWhere('user.isBanned = false')
        .getCount(),

      // Weekly active users (last 7 days)
      this.userRepository
        .createQueryBuilder('user')
        .where("user.lastActiveAt >= NOW() - INTERVAL '7 days'")
        .andWhere('user.isBanned = false')
        .getCount(),

      // Monthly active users (last 30 days)
      this.userRepository
        .createQueryBuilder('user')
        .where("user.lastActiveAt >= NOW() - INTERVAL '30 days'")
        .andWhere('user.isBanned = false')
        .getCount(),

      // Total non-banned users (denominator for avg submissions per user)
      this.userRepository.count({ where: { isBanned: false } }),

      // Total submissions count (numerator for avg submissions per user)
      this.submissionRepository.count(),
    ]);

    const dailyActiveUsers = results[0];
    const weeklyActiveUsers = results[1];
    const monthlyActiveUsers = results[2];
    const totalUsers = results[3];
    const totalSubmissions = results[4];

    const avgSubmissionsPerUser =
      totalUsers > 0 ? totalSubmissions / totalUsers : 0;

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      avgSubmissionsPerUser: Math.round(avgSubmissionsPerUser * 100) / 100,
    };
  }

  private async getRevenueMetrics(lang?: Language): Promise<RevenueMetricsDto> {
    // Determine display currency based on language
    const displayCurrency = this.getDisplayCurrency(lang);
    const amountColumn =
      displayCurrency === String(CurrencyCode.USD)
        ? 'systemReceivedAmountUsd'
        : 'systemReceivedAmountVnd';

    const results = await Promise.all([
      // Total premium users (active subscriptions)
      this.userRepository.count({
        where: {
          isPremium: true,
          isBanned: false,
        },
      }),

      // Total users for conversion rate
      this.userRepository.count({
        where: { isBanned: false },
      }),

      // Total revenue (all successful payments)
      this.paymentRepository
        .createQueryBuilder('payment')
        .select(
          `COALESCE(SUM(COALESCE(payment.${amountColumn}, 0)), 0)`,
          'total',
        )
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .getRawOne(),

      // Revenue today
      this.paymentRepository
        .createQueryBuilder('payment')
        .select(
          `COALESCE(SUM(COALESCE(payment.${amountColumn}, 0)), 0)`,
          'total',
        )
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere('payment.paymentDate >= CURRENT_DATE')
        .getRawOne(),

      // Revenue this week
      this.paymentRepository
        .createQueryBuilder('payment')
        .select(
          `COALESCE(SUM(COALESCE(payment.${amountColumn}, 0)), 0)`,
          'total',
        )
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere("payment.paymentDate >= NOW() - INTERVAL '7 days'")
        .getRawOne(),

      // Revenue this month
      this.paymentRepository
        .createQueryBuilder('payment')
        .select(
          `COALESCE(SUM(COALESCE(payment.${amountColumn}, 0)), 0)`,
          'total',
        )
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere("payment.paymentDate >= NOW() - INTERVAL '30 days'")
        .getRawOne(),

      // New premium users today (users who became premium today)
      this.userRepository
        .createQueryBuilder('user')
        .where('user.isPremium = true')
        .andWhere('user.premiumStartedAt >= CURRENT_DATE')
        .andWhere('user.isBanned = false')
        .getCount(),

      // New premium users this week
      this.userRepository
        .createQueryBuilder('user')
        .where('user.isPremium = true')
        .andWhere("user.premiumStartedAt >= NOW() - INTERVAL '7 days'")
        .andWhere('user.isBanned = false')
        .getCount(),

      // New premium users this month
      this.userRepository
        .createQueryBuilder('user')
        .where('user.isPremium = true')
        .andWhere("user.premiumStartedAt >= NOW() - INTERVAL '30 days'")
        .andWhere('user.isBanned = false')
        .getCount(),
    ]);

    const totalPremiumUsers = results[0];
    const totalUsers = results[1];
    const totalRevenueResult = results[2] as { total: string } | undefined;
    const revenueTodayResult = results[3] as { total: string } | undefined;
    const revenueThisWeekResult = results[4] as { total: string } | undefined;
    const revenueThisMonthResult = results[5] as { total: string } | undefined;
    const newPremiumToday = results[6];
    const newPremiumThisWeek = results[7];
    const newPremiumThisMonth = results[8];

    const totalRevenue = parseFloat(
      (totalRevenueResult as { total: string })?.total || '0',
    );
    const revenueToday = parseFloat(
      (revenueTodayResult as { total: string })?.total || '0',
    );
    const revenueThisWeek = parseFloat(
      (revenueThisWeekResult as { total: string })?.total || '0',
    );
    const revenueThisMonth = parseFloat(
      (revenueThisMonthResult as { total: string })?.total || '0',
    );

    // Calculate conversion rate
    const premiumConversionRate =
      totalUsers > 0 ? (totalPremiumUsers / totalUsers) * 100 : 0;

    // Calculate ARPU (Average Revenue Per Premium User)
    const averageRevenuePerUser =
      totalPremiumUsers > 0 ? totalRevenue / totalPremiumUsers : 0;

    return {
      displayCurrency,
      totalPremiumUsers,
      premiumConversionRate: Math.round(premiumConversionRate * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueToday: Math.round(revenueToday * 100) / 100,
      revenueThisWeek: Math.round(revenueThisWeek * 100) / 100,
      revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
      newPremiumToday,
      newPremiumThisWeek,
      newPremiumThisMonth,
      averageRevenuePerUser: Math.round(averageRevenuePerUser * 100) / 100,
    };
  }

  /**
   * Get time series metrics for the specified date range (default: last 30 days)
   */
  @Cacheable({
    key: (from: unknown, to: unknown, lang: unknown) => {
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const endDate = to ? new Date(to as string | number | Date) : new Date();
      const startDate = from
        ? new Date(from as string | number | Date)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const normalizedLang = (lang as Language) || Language.EN;
      return `platform:timeseries:${fmt(startDate)}:${fmt(endDate)}:${normalizedLang}`;
    },
    ttl: CACHE_TTL.FIVE_MINUTES,
  })
  async getTimeSeriesMetrics(
    from?: Date,
    to?: Date,
    lang?: Language,
  ): Promise<TimeSeriesMetricsDto> {
    this.logger.log(
      `Fetching time series metrics from ${String(from)} to ${String(to)}`,
    );

    // Default to last 30 days if not provided
    const endDate = to ? new Date(to) : new Date();
    const startDate = from
      ? new Date(from)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Determine display currency
    const displayCurrency = this.getDisplayCurrency(lang);

    const [
      dailyNewUsers,
      dailySubmissions,
      dailyActiveUsers,
      dailyRevenue,
      dailyAcceptedSubmissions,
    ] = await Promise.all([
      this.getDailyNewUsers(startDate, endDate),
      this.getDailySubmissions(startDate, endDate),
      this.getDailyActiveUsers(startDate, endDate),
      this.getDailyRevenue(startDate, endDate, displayCurrency),
      this.getDailyAcceptedSubmissions(startDate, endDate),
    ]);

    return {
      displayCurrency,
      dailyNewUsers,
      dailySubmissions,
      dailyActiveUsers,
      dailyRevenue,
      dailyAcceptedSubmissions,
    };
  }

  /**
   * Get daily new user registrations for date range
   */
  private async getDailyNewUsers(
    from: Date,
    to: Date,
  ): Promise<TimeSeriesDataPointDto[]> {
    const results = await this.userRepository
      .createQueryBuilder('user')
      .select("DATE(user.createdAt AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(*)', 'value')
      .where('user.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('user.isBanned = false')
      .groupBy("DATE(user.createdAt AT TIME ZONE 'UTC')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; value: string }>();

    return this.fillMissingDates(results, from, to);
  }

  /**
   * Get daily submission counts for date range
   */
  private async getDailySubmissions(
    from: Date,
    to: Date,
  ): Promise<TimeSeriesDataPointDto[]> {
    const results = await this.submissionRepository
      .createQueryBuilder('submission')
      .select("DATE(submission.submittedAt AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(*)', 'value')
      .where('submission.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy("DATE(submission.submittedAt AT TIME ZONE 'UTC')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; value: string }>();

    return this.fillMissingDates(results, from, to);
  }

  /**
   * Get daily active users for date range
   */
  private async getDailyActiveUsers(
    from: Date,
    to: Date,
  ): Promise<TimeSeriesDataPointDto[]> {
    const results = await this.userRepository
      .createQueryBuilder('user')
      .select("DATE(user.lastActiveAt AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(DISTINCT user.id)', 'value')
      .where('user.lastActiveAt BETWEEN :from AND :to', { from, to })
      .andWhere('user.isBanned = false')
      .groupBy("DATE(user.lastActiveAt AT TIME ZONE 'UTC')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; value: string }>();

    return this.fillMissingDates(results, from, to);
  }

  /**
   * Get daily revenue for date range
   */
  private async getDailyRevenue(
    from: Date,
    to: Date,
    currency: string = String(CurrencyCode.VND),
  ): Promise<TimeSeriesDataPointDto[]> {
    const amountColumn =
      currency === String(CurrencyCode.USD)
        ? 'systemReceivedAmountUsd'
        : 'systemReceivedAmountVnd';

    const results = await this.paymentRepository
      .createQueryBuilder('payment')
      .select("DATE(payment.paymentDate AT TIME ZONE 'UTC')", 'date')
      .addSelect(
        `COALESCE(SUM(COALESCE(payment.${amountColumn}, 0)), 0)`,
        'value',
      )
      .where('payment.paymentDate BETWEEN :from AND :to', { from, to })
      .andWhere('payment.status = :status', { status: PaymentStatus.SUCCESS })
      .groupBy("DATE(payment.paymentDate AT TIME ZONE 'UTC')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; value: string }>();

    return this.fillMissingDates(results, from, to, true);
  }

  /**
   * Get daily accepted submissions for date range
   */
  private async getDailyAcceptedSubmissions(
    from: Date,
    to: Date,
  ): Promise<TimeSeriesDataPointDto[]> {
    const results = await this.submissionRepository
      .createQueryBuilder('submission')
      .select("DATE(submission.submittedAt AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(*)', 'value')
      .where('submission.submittedAt BETWEEN :from AND :to', { from, to })
      .andWhere('submission.status = :status', { status: 'ACCEPTED' })
      .groupBy("DATE(submission.submittedAt AT TIME ZONE 'UTC')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; value: string }>();

    return this.fillMissingDates(results, from, to);
  }

  /**
   * Get display currency based on language
   */
  private getDisplayCurrency(lang?: Language): string {
    const normalizedLang = lang || Language.EN;
    return String(normalizedLang) === String(Language.EN)
      ? CurrencyCode.USD
      : CurrencyCode.VND;
  }

  /**
   * Get USD to VND conversion rate
   */
  private async getUsdRateToVnd(): Promise<number> {
    const currencies = await this.currencyService.getActiveCurrencies();
    const usdCurrency = currencies.find(
      (c) => c.code === String(CurrencyCode.USD),
    );
    if (!usdCurrency) {
      this.logger.warn('USD currency not found, defaulting to 23500');
      return 23500;
    }
    return Number(usdCurrency.rateToVnd);
  }

  /**
   * Fill missing dates with zero values for continuous time series within range
   */
  private fillMissingDates(
    results: { date: string; value: string }[],
    from: Date,
    to: Date,
    isDecimal = false,
  ): TimeSeriesDataPointDto[] {
    const dataMap = new Map<string, number>();

    // Convert results to map
    results.forEach((r) => {
      const dateValue = r.date as unknown;
      const dateStr =
        dateValue instanceof Date
          ? dateValue.toISOString().split('T')[0]
          : String(r.date).split('T')[0];
      dataMap.set(
        dateStr,
        isDecimal ? parseFloat(r.value) : parseInt(r.value, 10),
      );
    });

    // Generate all dates for the range
    const filledData: TimeSeriesDataPointDto[] = [];
    const currentDate = new Date(from);
    const endDate = new Date(to);

    // Ensure we iterate day by day
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      filledData.push({
        date: dateStr,
        value: isDecimal
          ? Math.round((dataMap.get(dateStr) ?? 0) * 100) / 100
          : (dataMap.get(dateStr) ?? 0),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return filledData;
  }
}

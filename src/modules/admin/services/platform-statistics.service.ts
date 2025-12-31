import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { Contest } from '../../contest/entities/contest.entity';
import { Submission } from '../../submissions/entities/submission.entity';
import {
  PaymentTransaction,
  PaymentStatus,
} from '../../payments/entities/payment-transaction.entity';
import { Cacheable } from '../../../common/decorators/cacheable.decorator';
import { CACHE_TTL } from '../../../common/constants/cache.constant';
import {
  PlatformStatisticsDto,
  PlatformMetricsDto,
  GrowthMetricsDto,
  EngagementMetricsDto,
  RevenueMetricsDto,
} from '../dto/platform-statistics.dto';

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
  ) {}

  @Cacheable({
    key: () => 'platform:statistics',
    ttl: CACHE_TTL.FIVE_MINUTES,
  })
  async getPlatformStatistics(): Promise<PlatformStatisticsDto> {
    this.logger.log('Fetching platform-wide statistics');

    const [platform, growth, engagement, revenue] = await Promise.all([
      this.getPlatformMetrics(),
      this.getGrowthMetrics(),
      this.getEngagementMetrics(),
      this.getRevenueMetrics(),
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
      // Total users (excluding banned)
      this.userRepository.count({
        where: { isBanned: false },
      }),

      // Active users (last 30 days)
      this.userRepository
        .createQueryBuilder('user')
        .where("user.lastActiveAt >= NOW() - INTERVAL '30 days'")
        .andWhere('user.isBanned = false')
        .getCount(),

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
        .where('submission.createdAt >= CURRENT_DATE')
        .getCount(),

      // Submissions this week
      this.submissionRepository
        .createQueryBuilder('submission')
        .where("submission.createdAt >= NOW() - INTERVAL '7 days'")
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

      // Average submissions per user
      this.submissionRepository
        .createQueryBuilder('submission')
        .select('COALESCE(AVG(sub_count), 0)', 'avg')
        .from((subQuery) => {
          return subQuery
            .select('COUNT(*)', 'sub_count')
            .from(Submission, 'submission')
            .groupBy('submission.userId');
        }, 'grouped')
        .getRawOne(),
    ]);

    const dailyActiveUsers = results[0];
    const weeklyActiveUsers = results[1];
    const monthlyActiveUsers = results[2];
    const avgSubmissionsResult = results[3] as { avg: string } | undefined;

    const avgSubmissionsPerUser =
      (avgSubmissionsResult as { avg: string } | undefined)?.avg !== null &&
      (avgSubmissionsResult as { avg: string } | undefined)?.avg !== undefined
        ? parseFloat((avgSubmissionsResult as { avg: string }).avg)
        : 0;

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      avgSubmissionsPerUser: Math.round(avgSubmissionsPerUser * 100) / 100,
    };
  }

  private async getRevenueMetrics(): Promise<RevenueMetricsDto> {
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
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .getRawOne(),

      // Revenue today
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere('payment.paymentDate >= CURRENT_DATE')
        .getRawOne(),

      // Revenue this week
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere("payment.paymentDate >= NOW() - INTERVAL '7 days'")
        .getRawOne(),

      // Revenue this month
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
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

    const totalRevenue =
      (totalRevenueResult as { total: string } | undefined)?.total !== null &&
      (totalRevenueResult as { total: string } | undefined)?.total !== undefined
        ? parseFloat((totalRevenueResult as { total: string }).total)
        : 0;
    const revenueToday =
      (revenueTodayResult as { total: string } | undefined)?.total !== null &&
      (revenueTodayResult as { total: string } | undefined)?.total !== undefined
        ? parseFloat((revenueTodayResult as { total: string }).total)
        : 0;
    const revenueThisWeek =
      (revenueThisWeekResult as { total: string } | undefined)?.total !==
        null &&
      (revenueThisWeekResult as { total: string } | undefined)?.total !==
        undefined
        ? parseFloat((revenueThisWeekResult as { total: string }).total)
        : 0;
    const revenueThisMonth =
      (revenueThisMonthResult as { total: string } | undefined)?.total !==
        null &&
      (revenueThisMonthResult as { total: string } | undefined)?.total !==
        undefined
        ? parseFloat((revenueThisMonthResult as { total: string }).total)
        : 0;

    // Calculate conversion rate
    const premiumConversionRate =
      totalUsers > 0 ? (totalPremiumUsers / totalUsers) * 100 : 0;

    // Calculate ARPU (Average Revenue Per User)
    const averageRevenuePerUser =
      totalUsers > 0 ? totalRevenue / totalUsers : 0;

    return {
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
}

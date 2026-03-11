import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Language } from 'src/modules/auth/enums/language.enum';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { NotificationType } from 'src/modules/notifications/enums/notification-type.enum';
import { StudyPlanItem } from '../entities/study-plan-item.entity';
import { StudyPlanTranslation } from '../entities/study-plan-translation.entity';
import { StudyPlan } from '../entities/study-plan.entity';

export interface StudyPlanProgressContext {
  userId: number;
  planId: number;
  problemId: number;
  previousSolvedCount: number;
  newSolvedCount: number;
  totalProblems: number;
  isCompleted: boolean;
}

const MILESTONE_PERCENTAGES = [25, 50, 75];

@Injectable()
export class StudyPlanNotificationService {
  private readonly logger = new Logger(StudyPlanNotificationService.name);

  constructor(
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(StudyPlanItem)
    private readonly itemRepository: Repository<StudyPlanItem>,
    @InjectRepository(StudyPlanTranslation)
    private readonly translationRepository: Repository<StudyPlanTranslation>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyProgressUpdate(ctx: StudyPlanProgressContext): Promise<void> {
    try {
      // No new progress — skip all notifications
      if (ctx.newSolvedCount <= ctx.previousSolvedCount) return;

      if (ctx.isCompleted) {
        await this.notifyPlanCompleted(ctx);
        return;
      }

      // Check milestone first (higher priority), then day completion
      const milestoneNotified = await this.notifyMilestoneIfReached(ctx);
      if (!milestoneNotified) {
        await this.notifyDayCompletedIfApplicable(ctx);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send study plan notification for user ${ctx.userId}, plan ${ctx.planId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // ─── Plan completed ─────────────────────────────────────────────────

  private async notifyPlanCompleted(
    ctx: StudyPlanProgressContext,
  ): Promise<void> {
    const plan = await this.getPlanWithTranslations(ctx.planId);
    if (!plan) return;

    const enName = this.getTranslatedName(plan, 'en');
    const viName = this.getTranslatedName(plan, 'vi');

    await this.notificationsService.create({
      recipientId: ctx.userId,
      type: NotificationType.STUDY_PLAN,
      metadata: {
        event: 'plan_completed',
        studyPlanId: ctx.planId,
        studyPlanSlug: plan.slug,
        totalProblems: ctx.totalProblems,
      },
      translations: [
        {
          languageCode: Language.EN,
          title: 'Study Plan Completed!',
          content: `Congratulations! You've completed all ${ctx.totalProblems} problems in "${enName}".`,
        },
        {
          languageCode: Language.VI,
          title: 'Hoàn thành Kế hoạch Học tập!',
          content: `Chúc mừng! Bạn đã hoàn thành tất cả ${ctx.totalProblems} bài trong "${viName}".`,
        },
      ],
    });
  }

  // ─── Milestone (25%, 50%, 75%) ──────────────────────────────────────

  private async notifyMilestoneIfReached(
    ctx: StudyPlanProgressContext,
  ): Promise<boolean> {
    if (ctx.totalProblems === 0) return false;

    const prevPercent = Math.floor(
      (ctx.previousSolvedCount / ctx.totalProblems) * 100,
    );
    const newPercent = Math.floor(
      (ctx.newSolvedCount / ctx.totalProblems) * 100,
    );

    const crossedMilestone = MILESTONE_PERCENTAGES.find(
      (m) => prevPercent < m && newPercent >= m,
    );
    if (!crossedMilestone) return false;

    const plan = await this.getPlanWithTranslations(ctx.planId);
    if (!plan) return false;

    const enName = this.getTranslatedName(plan, 'en');
    const viName = this.getTranslatedName(plan, 'vi');

    await this.notificationsService.create({
      recipientId: ctx.userId,
      type: NotificationType.STUDY_PLAN,
      metadata: {
        event: 'progress_milestone',
        studyPlanId: ctx.planId,
        studyPlanSlug: plan.slug,
        milestone: crossedMilestone,
        solvedCount: ctx.newSolvedCount,
        totalProblems: ctx.totalProblems,
      },
      translations: [
        {
          languageCode: Language.EN,
          title: `${crossedMilestone}% Progress Milestone!`,
          content: `You've reached ${crossedMilestone}% in "${enName}" — ${ctx.newSolvedCount}/${ctx.totalProblems} problems solved.`,
        },
        {
          languageCode: Language.VI,
          title: `Cột mốc ${crossedMilestone}%!`,
          content: `Bạn đã đạt ${crossedMilestone}% trong "${viName}" — ${ctx.newSolvedCount}/${ctx.totalProblems} bài đã giải.`,
        },
      ],
    });

    return true;
  }

  // ─── Day completed ──────────────────────────────────────────────────

  private async notifyDayCompletedIfApplicable(
    ctx: StudyPlanProgressContext,
  ): Promise<void> {
    // Find which day the just-solved problem belongs to
    const solvedItem = await this.itemRepository.findOne({
      where: { studyPlanId: ctx.planId, problemId: ctx.problemId },
      select: ['id', 'dayNumber'],
    });
    if (!solvedItem) return;

    const dayNumber = solvedItem.dayNumber;

    // Get all problem IDs for that day
    const dayItems = await this.itemRepository.find({
      where: { studyPlanId: ctx.planId, dayNumber },
      select: ['problemId'],
    });
    if (dayItems.length <= 1) return; // Skip single-problem days

    const dayProblemIds = dayItems.map((i) => i.problemId);

    // Check if all problems in this day are now solved
    const solvedRows: { count: string }[] =
      await this.itemRepository.manager.query(
        `SELECT COUNT(*) as count FROM user_problem_progress
         WHERE user_id = $1 AND problem_id = ANY($2) AND status = 'solved'`,
        [ctx.userId, dayProblemIds],
      );
    const solvedInDay = parseInt(solvedRows[0].count, 10);

    if (solvedInDay < dayItems.length) return;

    const plan = await this.getPlanWithTranslations(ctx.planId);
    if (!plan) return;

    const enName = this.getTranslatedName(plan, 'en');
    const viName = this.getTranslatedName(plan, 'vi');

    await this.notificationsService.create({
      recipientId: ctx.userId,
      type: NotificationType.STUDY_PLAN,
      metadata: {
        event: 'day_completed',
        studyPlanId: ctx.planId,
        studyPlanSlug: plan.slug,
        dayNumber,
        problemCount: dayItems.length,
      },
      translations: [
        {
          languageCode: Language.EN,
          title: `Day ${dayNumber} Completed!`,
          content: `You've solved all ${dayItems.length} problems for Day ${dayNumber} in "${enName}".`,
        },
        {
          languageCode: Language.VI,
          title: `Hoàn thành Ngày ${dayNumber}!`,
          content: `Bạn đã giải tất cả ${dayItems.length} bài của Ngày ${dayNumber} trong "${viName}".`,
        },
      ],
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private async getPlanWithTranslations(
    planId: number,
  ): Promise<StudyPlan | null> {
    return this.studyPlanRepository.findOne({
      where: { id: planId },
      relations: ['translations'],
    });
  }

  private getTranslatedName(plan: StudyPlan, lang: string): string {
    const translation =
      plan.translations?.find((t) => t.languageCode === lang) ??
      plan.translations?.[0];
    return translation?.name ?? plan.slug;
  }
}

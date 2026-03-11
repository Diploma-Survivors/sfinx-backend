import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Repository } from 'typeorm';
import {
  EnrolledPlanResponseDto,
  StudyPlanProgressResponseDto,
} from '../dto/study-plan-response.dto';
import { StudyPlanEnrollment } from '../entities/study-plan-enrollment.entity';
import { StudyPlanItem } from '../entities/study-plan-item.entity';
import { StudyPlan } from '../entities/study-plan.entity';
import { EnrollmentStatus } from '../enums/enrollment-status.enum';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';
import { StudyPlanNotificationService } from './study-plan-notification.service';
import { StudyPlanQueryService } from './study-plan-query.service';

@Injectable()
export class StudyPlanEnrollmentService {
  private readonly logger = new Logger(StudyPlanEnrollmentService.name);

  constructor(
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(StudyPlanItem)
    private readonly itemRepository: Repository<StudyPlanItem>,
    @InjectRepository(StudyPlanEnrollment)
    private readonly enrollmentRepository: Repository<StudyPlanEnrollment>,
    private readonly queryService: StudyPlanQueryService,
    private readonly notificationService: StudyPlanNotificationService,
  ) {}

  async enroll(planId: number, user: User): Promise<StudyPlanEnrollment> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${planId} not found`);
    }
    if (plan.status !== StudyPlanStatus.PUBLISHED) {
      throw new BadRequestException('Cannot enroll in an unpublished plan');
    }
    if (plan.isPremium && !user.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required for this plan',
      );
    }

    const existing = await this.enrollmentRepository.findOne({
      where: { studyPlanId: planId, userId: user.id },
    });
    if (existing) {
      throw new BadRequestException('Already enrolled in this plan');
    }

    const enrollment = this.enrollmentRepository.create({
      studyPlanId: planId,
      userId: user.id,
    });

    await this.enrollmentRepository.save(enrollment);
    await this.studyPlanRepository.increment(
      { id: planId },
      'enrollmentCount',
      1,
    );

    // Sync initial progress (user may have already solved some problems)
    await this.syncEnrollmentProgress(planId, user.id);

    return this.enrollmentRepository.findOne({
      where: { studyPlanId: planId, userId: user.id },
      relations: ['studyPlan', 'studyPlan.translations'],
    }) as Promise<StudyPlanEnrollment>;
  }

  async unenroll(planId: number, userId: number): Promise<void> {
    const result = await this.enrollmentRepository.delete({
      studyPlanId: planId,
      userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Enrollment not found');
    }
    await this.studyPlanRepository.decrement(
      { id: planId },
      'enrollmentCount',
      1,
    );
  }

  async getEnrolledPlans(
    userId: number,
    lang: string = 'en',
  ): Promise<EnrolledPlanResponseDto[]> {
    const enrollments = await this.enrollmentRepository.find({
      where: { userId },
      relations: ['studyPlan', 'studyPlan.translations'],
      order: { enrolledAt: 'DESC' },
    });

    if (!enrollments.length) return [];

    // Batch count items per plan to avoid N+1
    const planIds = enrollments.map((e) => e.studyPlanId);
    const counts: { study_plan_id: number; count: string }[] =
      await this.itemRepository.manager.query(
        `SELECT study_plan_id, COUNT(*)::text as count
         FROM study_plan_items
         WHERE study_plan_id = ANY($1)
         GROUP BY study_plan_id`,
        [planIds],
      );
    const totalProblemsMap = new Map(
      counts.map((c) => [c.study_plan_id, parseInt(c.count, 10)]),
    );

    return enrollments.map((e): EnrolledPlanResponseDto => {
      const card = this.queryService.mapPlanCard(e.studyPlan, lang);
      return {
        ...card,
        enrollmentStatus: e.status,
        currentDay: e.currentDay,
        totalProblems: totalProblemsMap.get(e.studyPlanId) ?? 0,
        solvedCount: e.solvedCount,
        lastActivityAt: e.lastActivityAt,
        completedAt: e.completedAt,
        enrolledAt: e.enrolledAt,
      };
    });
  }

  async getPlanProgress(
    planId: number,
    userId: number,
    lang: string = 'en',
  ): Promise<StudyPlanProgressResponseDto> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { studyPlanId: planId, userId },
      relations: ['studyPlan', 'studyPlan.translations'],
    });
    if (!enrollment) {
      throw new NotFoundException('Not enrolled in this plan');
    }

    const plan = enrollment.studyPlan;
    const items = await this.itemRepository.find({
      where: { studyPlanId: planId },
      relations: ['problem'],
      order: { dayNumber: 'ASC', orderIndex: 'ASC' },
    });

    const problemIds = items.map((i) => i.problemId);
    let progressMap = new Map<number, string>();
    if (problemIds.length) {
      const progressRows: { problem_id: number; status: string }[] =
        await this.itemRepository.manager.query(
          `SELECT problem_id, status FROM user_problem_progress
           WHERE user_id = $1 AND problem_id = ANY($2)`,
          [userId, problemIds],
        );
      progressMap = new Map(progressRows.map((r) => [r.problem_id, r.status]));
    }

    const days = this.queryService.groupItemsByDay(items, progressMap, lang);
    const summary = this.queryService.mapPlanCard(plan, lang);
    const totalProblems = items.length;
    const progressPercentage =
      totalProblems > 0
        ? Math.round((enrollment.solvedCount / totalProblems) * 100)
        : 0;

    return {
      ...summary,
      enrollmentStatus: enrollment.status,
      currentDay: enrollment.currentDay,
      solvedCount: enrollment.solvedCount,
      totalProblems,
      progressPercentage,
      completedAt: enrollment.completedAt,
      enrolledAt: enrollment.enrolledAt,
      days,
    };
  }

  // ─── Progress sync (called by event listener) ──────────────────────

  async syncEnrollmentProgress(
    planId: number,
    userId: number,
    problemId?: number,
  ): Promise<void> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { studyPlanId: planId, userId },
    });
    if (!enrollment || enrollment.status === EnrollmentStatus.COMPLETED) {
      return;
    }

    const items = await this.itemRepository.find({
      where: { studyPlanId: planId },
      select: ['problemId'],
    });
    if (!items.length) return;

    const problemIds = items.map((i) => i.problemId);
    const previousSolvedCount = enrollment.solvedCount;

    const result: { count: string }[] = await this.itemRepository.manager.query(
      `SELECT COUNT(*) as count FROM user_problem_progress
         WHERE user_id = $1 AND problem_id = ANY($2) AND status = 'solved'`,
      [userId, problemIds],
    );
    const solvedCount = parseInt(result[0].count, 10);

    enrollment.solvedCount = solvedCount;
    enrollment.lastActivityAt = new Date();

    const isCompleted = solvedCount >= items.length;
    if (isCompleted) {
      enrollment.status = EnrollmentStatus.COMPLETED;
      enrollment.completedAt = new Date();
    }

    await this.enrollmentRepository.save(enrollment);

    // Send notification if progress changed and problemId is known
    if (problemId && solvedCount > previousSolvedCount) {
      await this.notificationService.notifyProgressUpdate({
        userId,
        planId,
        problemId,
        previousSolvedCount,
        newSolvedCount: solvedCount,
        totalProblems: items.length,
        isCompleted,
      });
    }
  }

  async syncProgressForProblem(
    userId: number,
    problemId: number,
  ): Promise<void> {
    const enrollments = await this.enrollmentRepository
      .createQueryBuilder('e')
      .innerJoin(
        'study_plan_items',
        'spi',
        'spi.study_plan_id = e.study_plan_id',
      )
      .where('e.user_id = :userId', { userId })
      .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
      .andWhere('spi.problem_id = :problemId', { problemId })
      .getMany();

    for (const enrollment of enrollments) {
      await this.syncEnrollmentProgress(
        enrollment.studyPlanId,
        userId,
        problemId,
      );
    }
  }
}

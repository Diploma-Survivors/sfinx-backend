import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginatedResultDto } from 'src/common/dto/paginated-result.dto';
import { SortOrder } from 'src/common/dto/pagination-query.dto';
import { StorageService } from 'src/modules/storage/storage.service';
import { User } from 'src/modules/auth/entities/user.entity';
import { FilterStudyPlanDto } from '../dto/filter-study-plan.dto';
import {
  StudyPlanDayResponseDto,
  StudyPlanDetailResponseDto,
  StudyPlanItemResponseDto,
  StudyPlanListItemResponseDto,
  StudyPlanSummaryResponseDto,
} from '../dto/study-plan-response.dto';
import { StudyPlan } from '../entities/study-plan.entity';
import { StudyPlanItem } from '../entities/study-plan-item.entity';
import { StudyPlanEnrollment } from '../entities/study-plan-enrollment.entity';
import { StudyPlanTranslation } from '../entities/study-plan-translation.entity';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';

@Injectable()
export class StudyPlanQueryService {
  constructor(
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(StudyPlanItem)
    private readonly itemRepository: Repository<StudyPlanItem>,
    @InjectRepository(StudyPlanEnrollment)
    private readonly enrollmentRepository: Repository<StudyPlanEnrollment>,
    private readonly storageService: StorageService,
  ) {}

  async findAll(
    query: FilterStudyPlanDto,
    lang: string = 'en',
    userId?: number,
  ): Promise<PaginatedResultDto<StudyPlanListItemResponseDto>> {
    const qb = this.studyPlanRepository
      .createQueryBuilder('sp')
      .leftJoinAndSelect('sp.translations', 'spt')
      .leftJoinAndSelect('sp.topics', 'topics')
      .leftJoinAndSelect('sp.tags', 'tags')
      .where('sp.status = :status', { status: StudyPlanStatus.PUBLISHED });

    this.applyFilters(qb, query, lang);
    qb.loadRelationCountAndMap('sp.totalProblems', 'sp.items');
    this.applySorting(qb, query, lang);
    qb.skip(query.skip).take(query.take);

    const [data, total] = await qb.getManyAndCount();

    let enrollmentMap = new Map<number, StudyPlanEnrollment>();
    if (userId && data.length) {
      const planIds = data.map((p) => p.id);
      const enrollments = await this.enrollmentRepository.find({
        where: { userId, studyPlanId: In(planIds) },
      });
      enrollmentMap = new Map(enrollments.map((e) => [e.studyPlanId, e]));
    }

    const mapped: StudyPlanListItemResponseDto[] = data.map(
      (plan: StudyPlan & { totalProblems?: number }) => {
        const summary = this.mapPlanWithTranslation(plan, lang);
        const enrollment = enrollmentMap.get(plan.id);
        return {
          ...summary,
          totalProblems: plan.totalProblems ?? 0,
          isEnrolled: !!enrollment,
          solvedCount: enrollment?.solvedCount ?? 0,
          enrollmentStatus: enrollment?.status ?? null,
        };
      },
    );

    return PaginatedResultDto.fromFindAndCount([mapped, total], {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async findByIdOrSlug(
    idOrSlug: string,
    lang: string = 'en',
    user?: User,
  ): Promise<StudyPlanDetailResponseDto> {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const where = isNumeric
      ? { id: parseInt(idOrSlug, 10), status: StudyPlanStatus.PUBLISHED }
      : { slug: idOrSlug, status: StudyPlanStatus.PUBLISHED };

    const plan = await this.studyPlanRepository.findOne({
      where,
      relations: ['translations', 'topics', 'tags'],
    });
    if (!plan) {
      throw new NotFoundException(`Study plan "${idOrSlug}" not found`);
    }

    if (plan.isPremium && !user?.isPremium) {
      throw new ForbiddenException(
        'Premium subscription required to access this study plan',
      );
    }

    const userId = user?.id;
    const items = await this.itemRepository.find({
      where: { studyPlanId: plan.id },
      relations: ['problem', 'problem.topics', 'problem.tags'],
      order: { dayNumber: 'ASC', orderIndex: 'ASC' },
    });

    let progressMap = new Map<number, string>();
    if (userId && items.length) {
      const problemIds = items.map((i) => i.problemId);
      const progressRows: { problem_id: number; status: string }[] =
        await this.itemRepository.manager.query(
          `SELECT problem_id, status FROM user_problem_progress
           WHERE user_id = $1 AND problem_id = ANY($2)`,
          [userId, problemIds],
        );
      progressMap = new Map(progressRows.map((r) => [r.problem_id, r.status]));
    }

    let enrollment: StudyPlanEnrollment | null = null;
    if (userId) {
      enrollment = await this.enrollmentRepository.findOne({
        where: { studyPlanId: plan.id, userId },
      });
    }

    const days = this.groupItemsByDay(items, progressMap);
    const summary = this.mapPlanWithTranslation(plan, lang);

    return {
      ...summary,
      totalProblems: items.length,
      isEnrolled: !!enrollment,
      solvedCount: enrollment?.solvedCount ?? 0,
      enrollmentStatus: enrollment?.status ?? null,
      days,
    };
  }

  async getSimilarPlans(
    planId: number,
    lang: string = 'en',
  ): Promise<StudyPlanSummaryResponseDto[]> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${planId} not found`);
    }

    if (!plan.similarPlanIds?.length) {
      return [];
    }

    const similarPlans = await this.studyPlanRepository.find({
      where: {
        id: In(plan.similarPlanIds),
        status: StudyPlanStatus.PUBLISHED,
      },
      relations: ['translations', 'topics', 'tags'],
    });

    return this.mapPlansWithTranslation(similarPlans, lang);
  }

  // ─── Shared helpers (used by other services too) ──────────────────

  mapPlanWithTranslation(
    plan: StudyPlan,
    lang: string,
  ): StudyPlanSummaryResponseDto {
    const translation =
      plan.translations?.find((t) => t.languageCode === lang) ||
      plan.translations?.find((t) => t.languageCode === 'en') ||
      plan.translations?.[0];

    return {
      id: plan.id,
      slug: plan.slug,
      name: translation?.name ?? '',
      description: translation?.description ?? null,
      difficulty: plan.difficulty,
      status: plan.status,
      estimatedDays: plan.estimatedDays,
      coverImageUrl: plan.coverImageKey
        ? this.storageService.getCloudFrontUrl(plan.coverImageKey)
        : null,
      isPremium: plan.isPremium,
      enrollmentCount: plan.enrollmentCount,
      similarPlanIds: plan.similarPlanIds ?? [],
      topics: plan.topics ?? [],
      tags: plan.tags ?? [],
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  mapPlansWithTranslation(
    plans: StudyPlan[],
    lang: string,
  ): StudyPlanSummaryResponseDto[] {
    return plans.map((plan) => this.mapPlanWithTranslation(plan, lang));
  }

  groupItemsByDay(
    items: StudyPlanItem[],
    progressMap: Map<number, string>,
  ): StudyPlanDayResponseDto[] {
    const dayMap = new Map<number, StudyPlanItemResponseDto[]>();

    for (const item of items) {
      if (!dayMap.has(item.dayNumber)) {
        dayMap.set(item.dayNumber, []);
      }
      dayMap.get(item.dayNumber)!.push({
        id: item.id,
        dayNumber: item.dayNumber,
        orderIndex: item.orderIndex,
        note: item.note,
        problem: item.problem,
        progressStatus: progressMap.get(item.problemId) ?? null,
      });
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayNumber, dayItems]) => ({ dayNumber, items: dayItems }));
  }

  // ─── Private filter/sort helpers ──────────────────────────────────

  applyFilters(
    qb: SelectQueryBuilder<StudyPlan>,
    query: FilterStudyPlanDto,
    lang: string,
  ): void {
    if (query.difficulty) {
      qb.andWhere('sp.difficulty = :difficulty', {
        difficulty: query.difficulty,
      });
    }

    if (query.status) {
      qb.andWhere('sp.status = :filterStatus', {
        filterStatus: query.status,
      });
    }

    if (query.isPremium !== undefined) {
      qb.andWhere('sp.is_premium = :isPremium', {
        isPremium: query.isPremium,
      });
    }

    if (query.search) {
      qb.andWhere(
        'spt.name ILIKE :search AND spt.language_code = :searchLang',
        {
          search: `%${query.search}%`,
          searchLang: lang,
        },
      );
    }

    if (query.topicId) {
      qb.andWhere('topics.id = :topicId', { topicId: query.topicId });
    }

    if (query.tagId) {
      qb.andWhere('tags.id = :tagId', { tagId: query.tagId });
    }
  }

  applySorting(
    qb: SelectQueryBuilder<StudyPlan>,
    query: FilterStudyPlanDto,
    lang: string,
  ): void {
    const sortOrder: 'ASC' | 'DESC' =
      query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
    const sortBy = query.sortBy || 'createdAt';

    if (sortBy === 'name') {
      qb.addSelect(
        (sub) =>
          sub
            .select('t.name')
            .from(StudyPlanTranslation, 't')
            .where('t.study_plan_id = sp.id')
            .andWhere('t.language_code = :sortLang', { sortLang: lang })
            .limit(1),
        'sort_name',
      );
      qb.orderBy('sort_name', sortOrder);
    } else {
      qb.orderBy(`sp.${sortBy}`, sortOrder);
    }
  }
}

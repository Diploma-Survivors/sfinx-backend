import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import slugify from 'slugify';
import { In, Repository } from 'typeorm';
import { PaginatedResultDto, SortOrder } from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { CacheKeys, CacheService } from '../../redis';
import {
  AddContestProblemDto,
  CreateContestDto,
  FilterContestDto,
  UpdateContestDto,
  ContestDetailResponseDto,
} from '../dto';
import { Contest, ContestParticipant, ContestProblem } from '../entities';
import { ContestStatus, UserContestStatus } from '../enums';

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ContestCreatedEvent,
  ContestDeletedEvent,
  ContestUpdatedEvent,
} from '../events/contest-scheduled.events';

@Injectable()
export class ContestService {
  private readonly logger = new Logger(ContestService.name);

  constructor(
    @InjectRepository(Contest)
    private readonly contestRepository: Repository<Contest>,
    @InjectRepository(ContestProblem)
    private readonly contestProblemRepository: Repository<ContestProblem>,
    @InjectRepository(ContestParticipant)
    private readonly participantRepository: Repository<ContestParticipant>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new contest
   */
  async createContest(dto: CreateContestDto, userId: number): Promise<Contest> {
    // Validate timing
    this.validateContestTiming(dto.startTime, dto.endTime);

    // Generate slug
    const slug = await this.generateUniqueSlug(dto.title);

    // Calculate duration
    const durationMinutes = Math.round(
      (dto.endTime.getTime() - dto.startTime.getTime()) / 60000,
    );

    // Create contest
    const contest = this.contestRepository.create({
      title: dto.title,
      slug,
      description: dto.description ?? null,
      rules: dto.rules ?? null,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: dto.status ?? ContestStatus.DRAFT,
      maxParticipants: dto.maxParticipants ?? 0,
      durationMinutes,
      createdBy: { id: userId } as User,
    });
    const savedContest = await this.contestRepository.save(contest);

    // Emit created event
    this.eventEmitter.emit(
      ContestCreatedEvent.name,
      new ContestCreatedEvent(savedContest.id),
    );

    // Add problems if provided
    if (dto.problems && dto.problems.length > 0) {
      for (let i = 0; i < dto.problems.length; i++) {
        const prob = dto.problems[i];
        await this.addProblemToContest(savedContest, {
          problemId: prob.problemId,
          points: prob.points ?? 100,
          label: prob.label ?? this.getDefaultLabel(i),
          orderIndex: prob.orderIndex ?? i,
        });
      }
    }

    return this.getContestById(savedContest.id);
  }

  /**
   * Update a contest
   */
  async updateContest(id: number, dto: UpdateContestDto): Promise<Contest> {
    const contest = await this.getContestById(id);
    // Check if contest is not running or ended
    if (
      contest.status === ContestStatus.RUNNING ||
      contest.status === ContestStatus.ENDED
    ) {
      throw new BadRequestException(
        'Cannot add problems to running or ended contests',
      );
    }

    // Validate timing if provided
    const startTime = dto.startTime ?? contest.startTime;
    const endTime = dto.endTime ?? contest.endTime;
    this.validateContestTiming(startTime, endTime);

    // Prepare update data
    const updateData: Partial<Contest> = {};

    // Update fields
    if (dto.title !== undefined) {
      updateData.title = dto.title;
      updateData.slug = await this.generateUniqueSlug(dto.title, id);
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.rules !== undefined) updateData.rules = dto.rules;
    if (dto.startTime !== undefined) updateData.startTime = dto.startTime;
    if (dto.endTime !== undefined) updateData.endTime = dto.endTime;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.maxParticipants !== undefined)
      updateData.maxParticipants = dto.maxParticipants;

    // Recalculate duration if time changed
    if (dto.startTime || dto.endTime) {
      const s = dto.startTime ?? contest.startTime;
      const e = dto.endTime ?? contest.endTime;
      updateData.durationMinutes = Math.round(
        (e.getTime() - s.getTime()) / 60000,
      );
    }

    // Save implementation:
    // Use update() to avoid cascade issues with relations (contestProblems)
    // trying to nullify foreign keys.
    if (Object.keys(updateData).length > 0) {
      await this.contestRepository.update(id, updateData);
    }

    // We need the updated entity for problem association if we changed keys,
    // but ID is constant.
    const updated = await this.getContestById(id);

    // Update problems if provided
    if (dto.problems !== undefined) {
      // Delete existing problems directly from repo
      await this.contestProblemRepository.delete({ contestId: id });

      // Add new problems
      if (dto.problems.length > 0) {
        for (let i = 0; i < dto.problems.length; i++) {
          const prob = dto.problems[i];
          // We pass 'updated' contest entity which has the ID.
          await this.addProblemToContest(updated, {
            problemId: prob.problemId,
            points: prob.points ?? 100,
            label: prob.label ?? this.getDefaultLabel(i),
            orderIndex: prob.orderIndex ?? i,
          });
        }
      }
    }

    // Emit updated event
    this.eventEmitter.emit(
      ContestUpdatedEvent.name,
      new ContestUpdatedEvent(updated.id),
    );

    // Invalidate cache
    await this.invalidateContestCache(id, contest.slug);

    // Return fresh entity to ensure we get the latest problems from DB
    return this.getContestById(updated.id);
  }

  /**
   * Delete a contest
   */
  async deleteContest(id: number): Promise<void> {
    const contest = await this.getContestById(id);

    // Only allow deleting DRAFT or CANCELLED contests
    if (
      contest.status !== ContestStatus.DRAFT &&
      contest.status !== ContestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Can only delete contests in DRAFT or CANCELLED status',
      );
    }

    await this.contestRepository.delete(id);
    this.eventEmitter.emit(
      ContestDeletedEvent.name,
      new ContestDeletedEvent(id),
    );
    await this.invalidateContestCache(id, contest.slug);
  }

  /**
   * Get contest by ID
   */
  async getContestById(id: number): Promise<Contest> {
    const contest = await this.contestRepository.findOne({
      where: { id },
      relations: ['contestProblems', 'contestProblems.problem', 'createdBy'],
    });

    if (!contest) {
      throw new NotFoundException(`Contest with ID ${id} not found`);
    }

    return contest;
  }

  async getContestDetailById(
    id: number,
    userId?: number,
  ): Promise<ContestDetailResponseDto> {
    const contest = await this.getContestById(id);
    return this.mapToDetailDto(contest, userId);
  }

  /**
   * Get contest by slug
   */
  async getContestBySlug(slug: string): Promise<Contest> {
    const contest = await this.contestRepository.findOne({
      where: { slug },
      relations: ['contestProblems', 'contestProblems.problem', 'createdBy'],
    });

    if (!contest) {
      throw new NotFoundException(`Contest with slug '${slug}' not found`);
    }

    return contest;
  }

  async getContestDetailBySlug(
    slug: string,
    userId?: number,
  ): Promise<ContestDetailResponseDto> {
    const contest = await this.getContestBySlug(slug);
    return this.mapToDetailDto(contest, userId);
  }

  /**
   * Get contests with filtering and pagination
   */
  async getContestsForNotAdminUser(
    filter: FilterContestDto,
    userId?: number,
  ): Promise<PaginatedResultDto<Contest>> {
    return this.queryContests(filter, userId, {
      excludeDrafts: true,
      populateUserStatus: true,
    });
  }

  async getContests(
    filter: FilterContestDto,
  ): Promise<PaginatedResultDto<Contest>> {
    return this.queryContests(filter, undefined, {
      excludeDrafts: false,
      populateUserStatus: false,
    });
  }

  private async queryContests(
    filter: FilterContestDto,
    userId?: number,
    options: { excludeDrafts: boolean; populateUserStatus: boolean } = {
      excludeDrafts: false,
      populateUserStatus: false,
    },
  ): Promise<PaginatedResultDto<Contest>> {
    const queryBuilder = this.contestRepository
      .createQueryBuilder('contest')
      .leftJoinAndSelect('contest.contestProblems', 'contestProblems')
      .leftJoinAndSelect('contest.createdBy', 'createdBy');

    // Apply filters
    if (filter.status) {
      queryBuilder.andWhere('contest.status = :status', {
        status: filter.status,
      });
    }

    if (filter.startAfter) {
      queryBuilder.andWhere('contest.startTime >= :startAfter', {
        startAfter: filter.startAfter,
      });
    }

    if (filter.startBefore) {
      queryBuilder.andWhere('contest.startTime <= :startBefore', {
        startBefore: filter.startBefore,
      });
    }

    if (filter.upcomingOnly) {
      queryBuilder.andWhere('contest.status = :scheduled', {
        scheduled: ContestStatus.SCHEDULED,
      });
      queryBuilder.andWhere('contest.startTime > :now', { now: new Date() });
    }

    if (filter.runningOnly) {
      queryBuilder.andWhere('contest.status = :running', {
        running: ContestStatus.RUNNING,
      });
    }

    if (filter.search) {
      queryBuilder.andWhere('contest.title ILIKE :search', {
        search: `%${filter.search}%`,
      });
    }

    if (options.excludeDrafts) {
      queryBuilder.andWhere('contest.status != :draft', {
        draft: ContestStatus.DRAFT,
      });
    }

    if (options.populateUserStatus && userId && filter.userStatus) {
      if (filter.userStatus === UserContestStatus.JOINED) {
        queryBuilder.innerJoin(
          'contest.participants',
          'participant',
          'participant.user.id = :userId',
          { userId },
        );
      } else if (filter.userStatus === UserContestStatus.NOT_JOINED) {
        queryBuilder.andWhere(
          (qb) => {
            const subQuery = qb
              .subQuery()
              .select('p.contestId')
              .from('contest_participants', 'p')
              .where('p.userId = :userId', { userId })
              .getQuery();
            return `contest.id NOT IN ${subQuery}`;
          },
          { userId },
        );
      }
    }

    // Apply sorting
    const sortBy = filter.sortBy || 'startTime';
    const sortOrder = filter.sortOrder || 'DESC';
    queryBuilder.orderBy(`contest.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip(filter.skip).take(filter.take);

    const [contests, total] = await queryBuilder.getManyAndCount();

    // Map userStatus property to each contest if userId is provided
    if (options.populateUserStatus && userId) {
      const contestIds = contests.map((c) => c.id);
      if (contestIds.length > 0) {
        const participations = await this.participantRepository.find({
          where: {
            userId,
            contestId: In(contestIds),
          },
          select: ['contestId'],
        });
        const joinedContestIds = new Set(
          participations.map((p) => p.contestId),
        );
        contests.forEach((c) => {
          (c as Contest & { userStatus?: UserContestStatus }).userStatus =
            joinedContestIds.has(c.id)
              ? UserContestStatus.JOINED
              : UserContestStatus.NOT_JOINED;
        });
      }
    }

    return new PaginatedResultDto(contests, {
      page: filter.page ?? 1,
      limit: filter.limit ?? 20,
      total,
    });
  }

  /**
   * Add problem to contest
   */
  async addProblemToContest(
    contest: Contest,
    dto: AddContestProblemDto,
  ): Promise<ContestProblem> {
    // Check if problem exists
    const problem = await this.problemRepository.findOne({
      where: { id: dto.problemId },
    });
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${dto.problemId} not found`);
    }

    // Check if already added
    const existing = await this.contestProblemRepository.findOne({
      where: { contestId: contest.id, problemId: dto.problemId },
    });
    if (existing) {
      throw new ConflictException('Problem already added to contest');
    }

    // Get max order index
    const maxOrder = await this.contestProblemRepository
      .createQueryBuilder('cp')
      .select('MAX(cp.orderIndex)', 'max')
      .where('cp.contestId = :contestId', { contestId: contest.id })
      .getRawOne<{ max: number }>();

    const orderIndex = dto.orderIndex ?? (maxOrder?.max ?? -1) + 1;
    const label = dto.label ?? this.getDefaultLabel(orderIndex);

    const contestProblem = this.contestProblemRepository.create({
      contestId: contest.id,
      problemId: dto.problemId,
      points: dto.points ?? 100,
      orderIndex,
      label,
    });

    return await this.contestProblemRepository.save(contestProblem);
  }

  /**
   * Remove problem from contest
   */
  async removeProblemFromContest(
    contestId: number,
    problemId: number,
  ): Promise<void> {
    const contest = await this.getContestById(contestId);

    if (
      contest.status === ContestStatus.RUNNING ||
      contest.status === ContestStatus.ENDED
    ) {
      throw new BadRequestException(
        'Cannot remove problems from running or ended contests',
      );
    }

    const result = await this.contestProblemRepository.delete({
      contestId,
      problemId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Problem not found in contest');
    }

    await this.invalidateContestCache(contestId, contest.slug);
  }

  /**
   * Get contest problems
   * Problems are hidden until contest starts (unless admin)
   */
  async getContestProblems(
    contestId: number,
    user?: User,
  ): Promise<ContestProblem[]> {
    const contest = await this.getContestById(contestId);

    // Check if problems should be visible
    const canViewProblems = await this.canViewProblems(contest, user);
    if (!canViewProblems) {
      return [];
    }

    const problems = await this.contestProblemRepository.find({
      where: { contestId },
      relations: ['problem'],
      order: { orderIndex: SortOrder.ASC },
    });

    return problems;
  }

  /**
   * Reorder contest problems
   */
  async reorderContestProblems(
    contestId: number,
    problemOrder: number[],
  ): Promise<void> {
    const contest = await this.getContestById(contestId);

    if (
      contest.status === ContestStatus.RUNNING ||
      contest.status === ContestStatus.ENDED
    ) {
      throw new BadRequestException(
        'Cannot reorder problems in running or ended contests',
      );
    }

    for (let i = 0; i < problemOrder.length; i++) {
      await this.contestProblemRepository.update(
        { contestId, problemId: problemOrder[i] },
        { orderIndex: i, label: this.getDefaultLabel(i) },
      );
    }

    await this.invalidateContestCache(contestId, contest.slug);
  }

  /**
   * Join a contest (Idempotent)
   */
  async joinContest(
    contestId: number,
    userId: number,
  ): Promise<ContestParticipant> {
    const contest = await this.getContestById(contestId);

    // 1. Check if already registered
    const existing = await this.participantRepository.findOne({
      where: { contestId, userId },
    });
    if (existing) {
      return existing;
    }

    // 2. Validate Status
    if (
      contest.status !== ContestStatus.SCHEDULED &&
      contest.status !== ContestStatus.RUNNING
    ) {
      throw new BadRequestException(
        'Can only join scheduled or running contests',
      );
    }

    // 3. Check max participants
    if (
      contest.maxParticipants > 0 &&
      contest.participantCount >= contest.maxParticipants
    ) {
      throw new BadRequestException('Contest has reached maximum participants');
    }

    // 4. Create participant
    const participant = this.participantRepository.create({
      contestId,
      userId,
      user: { id: userId } as User,
      contest: { id: contestId } as Contest,
      totalScore: 0,
      problemScores: {},
      totalSubmissions: 0,
      startedAt: new Date(), // Set join time
    });

    const saved = await this.participantRepository.save(participant);

    // Update participant count
    await this.contestRepository.increment(
      { id: contestId },
      'participantCount',
      1,
    );

    return saved;
  }

  /**
   * Unregister user from contest
   */
  async unregisterFromContest(
    contestId: number,
    userId: number,
  ): Promise<void> {
    const contest = await this.getContestById(contestId);

    // Only allow unregistration before contest starts
    if (contest.status !== ContestStatus.SCHEDULED) {
      throw new BadRequestException(
        'Can only unregister from contests that have not started',
      );
    }

    const result = await this.participantRepository.delete({
      contestId,
      userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Not registered for this contest');
    }

    // Update participant count
    await this.contestRepository.decrement(
      { id: contestId },
      'participantCount',
      1,
    );
  }

  /**
   * Get participant record
   */
  async getParticipant(
    contestId: number,
    userId: number,
  ): Promise<ContestParticipant | null> {
    return this.participantRepository.findOne({
      where: { contestId, userId },
      relations: ['user'],
    });
  }

  /**
   * Check if user is registered for contest
   */
  async isUserRegistered(contestId: number, userId: number): Promise<boolean> {
    const count = await this.participantRepository.count({
      where: { contestId, userId },
    });
    return count > 0;
  }

  /**
   * Manually start a contest
   */
  async startContest(id: number): Promise<Contest> {
    const contest = await this.getContestById(id);

    if (contest.status !== ContestStatus.SCHEDULED) {
      throw new BadRequestException('Can only start scheduled contests');
    }

    contest.status = ContestStatus.RUNNING;
    const updated = await this.contestRepository.save(contest);
    await this.invalidateContestCache(id, contest.slug);

    this.logger.log(`Contest ${id} manually started`);
    return updated;
  }

  /**
   * Manually end a contest
   */
  async endContest(id: number): Promise<Contest> {
    const contest = await this.getContestById(id);

    if (
      contest.status !== ContestStatus.RUNNING &&
      contest.status !== ContestStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        'Can only end running or scheduled contests',
      );
    }

    // If ending a scheduled contest, ensure time has passed
    if (
      contest.status === ContestStatus.SCHEDULED &&
      contest.endTime > new Date()
    ) {
      throw new BadRequestException(
        'Cannot end a scheduled contest before its end time',
      );
    }

    contest.status = ContestStatus.ENDED;
    const updated = await this.contestRepository.save(contest);
    await this.invalidateContestCache(id, contest.slug);

    this.logger.log(`Contest ${id} manually ended`);
    return updated;
  }

  /**
   * Cancel a contest
   */
  async cancelContest(id: number): Promise<Contest> {
    const contest = await this.getContestById(id);

    if (contest.status === ContestStatus.ENDED) {
      throw new BadRequestException('Cannot cancel an ended contest');
    }

    contest.status = ContestStatus.CANCELLED;
    const updated = await this.contestRepository.save(contest);
    await this.invalidateContestCache(id, contest.slug);

    this.logger.log(`Contest ${id} cancelled`);
    return updated;
  }

  /**
   * Update contest statuses based on time (for scheduled jobs)
   */
  async updateContestStatuses(): Promise<void> {
    const now = new Date();

    // Start scheduled contests whose start time has passed
    await this.contestRepository
      .createQueryBuilder()
      .update(Contest)
      .set({ status: ContestStatus.RUNNING })
      .where('status = :scheduled', { scheduled: ContestStatus.SCHEDULED })
      .andWhere('startTime <= :now', { now })
      .execute();

    // End running contests whose end time has passed
    await this.contestRepository
      .createQueryBuilder()
      .update(Contest)
      .set({ status: ContestStatus.ENDED })
      .where('status = :running', { running: ContestStatus.RUNNING })
      .andWhere('endTime <= :now', { now })
      .execute();
  }

  /**
   * Check if contest is currently running
   */
  async isContestRunning(contestId: number): Promise<boolean> {
    const contest = await this.getContestById(contestId);
    return contest.status === ContestStatus.RUNNING;
  }

  /**
   * Check if user can view contest problems
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async canViewProblems(
    contest: Contest,
    user?: User,
  ): Promise<boolean> {
    // Admin can always view
    if (user?.role?.slug === 'admin') {
      return true;
    }

    // Problems visible during and after contest
    return (
      contest.status === ContestStatus.RUNNING ||
      contest.status === ContestStatus.ENDED
    );
  }

  /**
   * Validate contest timing
   */
  private validateContestTiming(startTime: Date, endTime: Date): void {
    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
    if (durationMinutes < 15) {
      throw new BadRequestException('Contest must be at least 15 minutes long');
    }

    if (durationMinutes > 1440 * 7) {
      throw new BadRequestException('Contest cannot be longer than 7 days');
    }
  }

  /**
   * Generate unique slug from title
   */
  private async generateUniqueSlug(
    title: string,
    excludeId?: number,
  ): Promise<string> {
    const baseSlug = slugify(title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const query = this.contestRepository
        .createQueryBuilder('contest')
        .where('contest.slug = :slug', { slug });

      if (excludeId) {
        query.andWhere('contest.id != :excludeId', { excludeId });
      }

      const existing = await query.getOne();
      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Get default problem label (A, B, C, ...)
   */
  private getDefaultLabel(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, ...
  }

  private async mapToDetailDto(
    contest: Contest,
    userId?: number,
  ): Promise<ContestDetailResponseDto> {
    const isRegistered = userId
      ? await this.isUserRegistered(contest.id, userId)
      : false;

    // Map problems
    const problems =
      contest.contestProblems?.map((cp) => ({
        problemId: cp.problemId,
        title: cp.problem.title,
        slug: cp.problem.slug,
        points: cp.points,
        orderIndex: cp.orderIndex,
        label: cp.label,
        difficulty: cp.problem.difficulty,
      })) || [];

    return {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      description: contest.description,
      rules: contest.rules,
      status: contest.status,
      startTime: contest.startTime,
      endTime: contest.endTime,
      durationMinutes: contest.durationMinutes,
      participantCount: contest.participantCount,
      maxParticipants: contest.maxParticipants,
      problemCount: problems.length,
      problems: problems,
      userStatus: isRegistered
        ? UserContestStatus.JOINED
        : UserContestStatus.NOT_JOINED,
      createdAt: contest.createdAt,
    };
  }

  /**
   * Invalidate contest cache
   */
  private async invalidateContestCache(
    contestId: number,
    slug: string,
  ): Promise<void> {
    await Promise.all([
      this.cacheService.invalidate(CacheKeys.contest.detail(contestId)),
      this.cacheService.invalidate(CacheKeys.contest.bySlug(slug)),
      this.cacheService.invalidate(CacheKeys.contest.problems(contestId)),
    ]);
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import slugify from 'slugify';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';

import { PaginatedResultDto } from '../../common';
import { User } from '../auth/entities/user.entity';
import { Action, CaslAbilityFactory } from '../rbac/casl';
import { StorageService } from '../storage/storage.service';
import { ProgressStatus } from '../submissions/enums';
import { CreateProblemDto } from './dto/create-problem.dto';
import { FilterProblemDto } from './dto/filter-problem.dto';
import { ProblemDetailDto } from './dto/problem-detail.dto';
import { ProblemListItemDto } from './dto/problem-list-item.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { Problem } from './entities/problem.entity';
import { TagService } from './services';
import { TestcaseFileService } from './services';
import { TopicService } from './services';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    private readonly testcaseService: TestcaseFileService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly topicService: TopicService,
    private readonly tagService: TagService,
    private readonly storageService: StorageService,
  ) {}

  @Transactional()
  async createProblem(
    createProblemDto: CreateProblemDto,
    testcaseFile: Express.Multer.File,
    userId: number,
  ): Promise<Problem> {
    const { title, topicIds, tagIds, ...problemData } = createProblemDto;

    const slug = this.generateSlug(title);

    // Check for duplicate slug
    await this.validateUniqueSlug(slug);

    // Fetch topics and tags using cached services
    const [topics, tags] = await Promise.all([
      this.topicService.findByIds(topicIds),
      this.tagService.findByIds(tagIds),
    ]);

    // Validate that all requested topics and tags exist
    this.validateRelatedEntities(topicIds, topics, 'Topics');
    this.validateRelatedEntities(tagIds, tags, 'Tags');

    // Create problem entity with all basic data
    const problem = this.problemRepository.create({
      ...problemData,
      title,
      slug,
      topics,
      tags,
      createdBy: { id: userId },
    });

    // Save problem first to get the ID for testcase upload
    const savedProblem = await this.problemRepository.save(problem);

    // Upload testcase file and update problem with testcase metadata
    const { key, testcaseCount } =
      await this.testcaseService.uploadTestcaseFile(
        testcaseFile,
        savedProblem.id,
      );

    savedProblem.testcaseFileKey = key;
    savedProblem.testcaseCount = testcaseCount;

    // Final save with testcase metadata
    await this.problemRepository.save(savedProblem);

    await this.updateSearchVector(savedProblem.id);

    return savedProblem;
  }

  /**
   * Validates that a slug is unique
   * @throws ConflictException if slug already exists
   */
  private async validateUniqueSlug(slug: string): Promise<void> {
    const existingProblem = await this.problemRepository.findOne({
      where: { slug },
    });

    if (existingProblem) {
      throw new ConflictException('Problem with similar title already exists');
    }
  }

  /**
   * Validates that all requested entity IDs exist in the database
   * @throws NotFoundException if any IDs are missing
   */
  private validateRelatedEntities<T extends { id: number }>(
    requestedIds: number[],
    foundEntities: T[],
    entityName: string,
  ): void {
    if (foundEntities.length !== requestedIds.length) {
      const foundIds = foundEntities.map((entity) => entity.id);
      const missingIds = requestedIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `${entityName} with IDs [${missingIds.join(', ')}] not found`,
      );
    }
  }

  async getProblems(
    filterDto: FilterProblemDto,
    user?: User,
  ): Promise<PaginatedResultDto<ProblemListItemDto>> {
    const { difficulty, isPremium, topicIds, tagIds, search, status } =
      filterDto;

    const queryBuilder = this.problemRepository
      .createQueryBuilder('problem')
      .leftJoinAndSelect('problem.tags', 'tags')
      .leftJoinAndSelect('problem.topics', 'topics');

    // Check if user has read_all permission
    const canReadAll = user
      ? this.caslAbilityFactory.createForUser(user).can(Action.ReadAll, Problem)
      : false;

    const commonFields = [
      'problem.id',
      'problem.title',
      'problem.slug',
      'problem.difficulty',
      'problem.isPremium',
      'problem.acceptanceRate',
      'tags',
      'topics',
    ];

    if (canReadAll) {
      queryBuilder.select([
        ...commonFields,
        'problem.isActive',
        'problem.totalSubmissions',
        'problem.totalAccepted',
        'problem.testcaseCount',
        'problem.timeLimitMs',
        'problem.memoryLimitKb',
        'problem.createdAt',
        'problem.updatedAt',
      ]);
    } else {
      queryBuilder.select(commonFields);
    }

    const targetUserId = filterDto.userId ?? user?.id;

    // Join user progress if needed:
    // 1. Filtering by status (requires progress)
    // 2. Explicitly requesting specific user's progress (userId provided)
    // 3. Authenticated normal user viewing list (needs to see their own progress)
    const shouldJoinProgress =
      targetUserId && (!!status || !!filterDto.userId || !canReadAll);

    if (shouldJoinProgress) {
      queryBuilder.leftJoinAndSelect(
        'problem.userProgress',
        'user_progress',
        'user_progress.userId = :userId',
        { userId: targetUserId },
      );

      if (status) {
        if (status === ProgressStatus.NOT_STARTED) {
          queryBuilder.andWhere(
            '(user_progress.status IS NULL OR user_progress.status = :status)',
            { status: ProgressStatus.NOT_STARTED },
          );
        } else {
          queryBuilder.andWhere('user_progress.status = :status', { status });
        }
      }
    }

    if (tagIds && tagIds.length > 0) {
      queryBuilder.andWhere('tags.id IN (:...tagIds)', { tagIds });
    }

    if (topicIds && topicIds.length > 0) {
      queryBuilder.andWhere('topics.id IN (:...topicIds)', { topicIds });
    }

    // Only apply active filters if user doesn't have read_all permission
    if (!canReadAll) {
      queryBuilder.andWhere('problem.isActive = :isActive', { isActive: true });
    } else if (filterDto.isActive !== undefined) {
      queryBuilder.andWhere('problem.isActive = :isActive', {
        isActive: filterDto.isActive,
      });
    }

    if (difficulty) {
      queryBuilder.andWhere('problem.difficulty = :difficulty', { difficulty });
    }

    if (isPremium !== undefined) {
      queryBuilder.andWhere('problem.isPremium = :isPremium', { isPremium });
    }

    if (search) {
      // Sanitize search query for tsquery
      const sanitizedSearch = search.replace(/[^\w\s]/g, ' ').trim();

      queryBuilder
        .addSelect(
          `ts_rank(problem.search_vector, plainto_tsquery('english', :search))`,
          'rank',
        )
        .andWhere(
          `problem.search_vector @@ plainto_tsquery('english', :search)`,
          { search: sanitizedSearch },
        );
    }

    const sortBy = filterDto.sortBy;
    const sortOrder = filterDto.sortOrder;

    // Ensure the sort column is selected to avoid "distinctAlias" errors
    const sortColumn = `problem.${sortBy}`;

    // Only add to selection if it's not already in the selected fields
    const isAlreadySelected =
      commonFields.includes(sortColumn) ||
      (canReadAll &&
        ['problem.createdAt', 'problem.updatedAt'].includes(sortColumn));

    if (!isAlreadySelected) {
      queryBuilder.addSelect(sortColumn);
    }

    // If searching, order by relevance (rank) first, then by sortBy
    if (search) {
      queryBuilder.orderBy('rank', 'DESC');
    }
    queryBuilder.addOrderBy(sortColumn, sortOrder);

    queryBuilder.skip(filterDto.skip).take(filterDto.take);

    const [items, total] = await queryBuilder.getManyAndCount();

    const results = items;

    if (shouldJoinProgress) {
      for (const item of results) {
        const progress = item.userProgress?.[0];
        (item as ProblemListItemDto).status = progress?.status ?? null;
        delete item.userProgress;
      }
    }

    return new PaginatedResultDto(results, {
      page: filterDto.page ?? 1,
      limit: filterDto.limit ?? 20,
      total,
    });
  }

  async findProblemEntityById(id: number): Promise<Problem> {
    const problem = await this.problemRepository.findOne({
      where: { id },
      relations: [
        'topics',
        'tags',
        'createdBy',
        'updatedBy',
        'sampleTestcases',
      ],
    });

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return problem;
  }

  async getProblemById(id: number, user?: User): Promise<ProblemDetailDto> {
    const queryBuilder = this.createProblemDetailQuery(user);

    queryBuilder.where('problem.id = :id', { id });

    const problem = await queryBuilder.getOne();

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    // Check premium access
    this.validatePremiumAccess(problem, user);

    return this.mapToDetailDto(problem);
  }

  async getProblemBySlug(slug: string, user?: User): Promise<ProblemDetailDto> {
    const queryBuilder = this.createProblemDetailQuery(user);

    queryBuilder.where('problem.slug = :slug', { slug });

    const problem = await queryBuilder.getOne();

    if (!problem) {
      throw new NotFoundException(`Problem with slug ${slug} not found`);
    }

    // Check premium access
    this.validatePremiumAccess(problem, user);

    return this.mapToDetailDto(problem);
  }

  private async mapToDetailDto(problem: Problem): Promise<ProblemDetailDto> {
    const { testcaseFileKey, userProgress, ...rest } = problem;
    let testcaseFileUrl: string | undefined;

    if (testcaseFileKey) {
      try {
        testcaseFileUrl =
          await this.storageService.getPresignedUrl(testcaseFileKey);
      } catch (error) {
        this.logger.error(
          `Failed to get presigned URL for testcase file: ${(error as Error).message}`,
        );
      }
    }

    let status: ProgressStatus | null = null;
    if (userProgress && userProgress.length > 0) {
      status = userProgress[0].status;
    }

    return {
      ...rest,
      testcaseFileUrl,
      status,
    } as unknown as ProblemDetailDto;
  }

  private createProblemDetailQuery(user?: User) {
    const queryBuilder = this.problemRepository
      .createQueryBuilder('problem')
      .leftJoinAndSelect('problem.tags', 'tags')
      .leftJoinAndSelect('problem.topics', 'topics');

    // Check if user has read_all permission
    const canReadAll = user
      ? this.caslAbilityFactory.createForUser(user).can(Action.ReadAll, Problem)
      : false;

    // Join user progress if user is authenticated and is NOT admin (or doesn't have read_all)
    // Matches logic in getProblems list
    const shouldJoinProgress = user && !canReadAll;

    if (shouldJoinProgress) {
      queryBuilder.leftJoinAndSelect(
        'problem.userProgress',
        'user_progress',
        'user_progress.userId = :userId',
        { userId: user.id },
      );
    }

    const commonFields = [
      'problem.id',
      'problem.title',
      'problem.slug',
      'problem.description',
      'problem.constraints',
      'problem.difficulty',
      'problem.isPremium',
      'problem.totalSubmissions',
      'problem.totalAccepted',
      'problem.acceptanceRate',
      'problem.totalAttempts',
      'problem.totalSolved',
      'problem.hints',
      'problem.hasOfficialSolution',
      'problem.similarProblems',
      'problem.timeLimitMs',
      'problem.memoryLimitKb',
      'tags',
      'topics',
    ];

    if (canReadAll) {
      queryBuilder
        .select([
          ...commonFields,
          'problem.isActive',
          'problem.testcaseCount',
          'problem.testcaseFileKey',
          'problem.officialSolutionContent',
          'problem.difficultyRating',
          'problem.averageTimeToSolve',
          'problem.createdAt',
          'problem.updatedAt',
          'createdBy',
          'updatedBy',
        ])
        .leftJoinAndSelect('problem.createdBy', 'createdBy')
        .leftJoinAndSelect('problem.updatedBy', 'updatedBy');
    } else {
      queryBuilder
        .select(commonFields)
        .andWhere('problem.isActive = :isActive', { isActive: true });
    }

    return queryBuilder;
  }

  /**
   * Validates if a user can access a premium problem
   * @throws ForbiddenException if problem is premium and user doesn't have access
   */
  private validatePremiumAccess(problem: Problem, user?: User): void {
    // If problem is not premium, allow access to everyone
    if (!problem.isPremium) {
      return;
    }

    // If problem is premium and user is not authenticated
    if (!user) {
      throw new ForbiddenException(
        'This is a premium problem. Please subscribe to access premium content.',
      );
    }

    // Check if user has premium access using CASL
    const ability = this.caslAbilityFactory.createForUser(user);
    const canAccessPremium = ability.can(Action.ReadPremium, problem);

    if (!canAccessPremium) {
      throw new ForbiddenException(
        'This is a premium problem. Please upgrade to premium to access this content.',
      );
    }
  }

  @Transactional()
  async updateProblem(
    id: number,
    updateProblemDto: UpdateProblemDto,
    userId: number,
  ): Promise<Problem> {
    const problem = await this.findProblemEntityById(id);

    const { topicIds, tagIds, title, ...updateData } = updateProblemDto;

    // Update slug if title changed
    if (title && title !== problem.title) {
      const slug = this.generateSlug(title);
      const existingProblem = await this.problemRepository.findOne({
        where: { slug },
      });

      if (existingProblem && existingProblem.id !== id) {
        throw new ConflictException(
          'Problem with similar title already exists',
        );
      }

      problem.title = title;
      problem.slug = slug;
    }

    // Update basic fields
    Object.assign(problem, updateData);
    problem.updatedBy = { id: userId } as User;

    // Update topics if provided
    if (topicIds !== undefined) {
      if (topicIds.length > 0) {
        const topics = await this.topicService.findByIds(topicIds);
        problem.topics = topics;
      } else {
        problem.topics = [];
      }
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      if (tagIds.length > 0) {
        const tags = await this.tagService.findByIds(tagIds);
        problem.tags = tags;
      } else {
        problem.tags = [];
      }
    }

    const savedProblem = await this.problemRepository.save(problem);
    await this.updateSearchVector(savedProblem.id);
    return savedProblem;
  }

  @Transactional()
  async deleteProblem(id: number): Promise<void> {
    const problem = await this.findProblemEntityById(id);
    await this.problemRepository.remove(problem);
  }

  private generateSlug(title: string): string {
    return slugify(title, { lower: true, strict: true });
  }

  @Transactional()
  async updateProblemStats(problemId: number): Promise<void> {
    const problem = await this.findProblemEntityById(problemId);

    if (problem.totalSubmissions > 0) {
      problem.acceptanceRate = Number(
        ((problem.totalAccepted / problem.totalSubmissions) * 100).toFixed(2),
      );
    }

    await this.problemRepository.save(problem);
  }

  async getRandomProblems(count: number = 5, user?: User): Promise<Problem[]> {
    const queryBuilder = this.problemRepository.createQueryBuilder('problem');

    // Check if user has read_all permission
    const canReadAll = user
      ? this.caslAbilityFactory.createForUser(user).can(Action.ReadAll, Problem)
      : false;

    // Only apply active filters if user doesn't have read_all permission
    if (!canReadAll) {
      queryBuilder.where('problem.isActive = :isActive', { isActive: true });
    }

    return queryBuilder.orderBy('RANDOM()').limit(count).getMany();
  }

  private async updateSearchVector(problemId: number) {
    await this.problemRepository
      .createQueryBuilder()
      .update(Problem)
      .set({
        searchVector: () =>
          `setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
           setweight(to_tsvector('english', coalesce(slug, '')), 'B') ||
           setweight(to_tsvector('english', coalesce(description, '')), 'C')`,
      })
      .where('id = :id', { id: problemId })
      .execute();
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';

import { PaginatedResultDto } from '../../common';
import { User } from '../auth/entities/user.entity';
import { Action, CaslAbilityFactory } from '../rbac/casl/casl-ability.factory';
import { CreateProblemDto } from './dto/create-problem.dto';
import { FilterProblemDto } from './dto/filter-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { Problem } from './entities/problem.entity';
import { Tag } from './entities/tag.entity';
import { Topic } from './entities/topic.entity';
import { TestcaseFileService } from './services';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly testcaseService: TestcaseFileService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
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

    // Fetch topics and tags in parallel for better performance
    const [topics, tags] = await Promise.all([
      this.topicRepository.findBy({ id: In(topicIds) }),
      this.tagRepository.findBy({ id: In(tagIds) }),
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
  ): Promise<PaginatedResultDto<Problem>> {
    const { difficulty, isPremium, topicIds, tagIds, search } = filterDto;

    const queryBuilder = this.problemRepository
      .createQueryBuilder('problem')
      .leftJoinAndSelect('problem.topics', 'topic')
      .leftJoinAndSelect('problem.tags', 'tag');

    // Check if user has read_all permission
    const canReadAll = user
      ? this.caslAbilityFactory.createForUser(user).can(Action.ReadAll, Problem)
      : false;

    // Only apply published/active filters if user doesn't have read_all permission
    if (!canReadAll) {
      queryBuilder
        .andWhere('problem.isPublished = :isPublished', { isPublished: true })
        .andWhere('problem.isActive = :isActive', { isActive: true });
    }

    if (difficulty) {
      queryBuilder.andWhere('problem.difficulty = :difficulty', { difficulty });
    }

    if (isPremium !== undefined) {
      queryBuilder.andWhere('problem.isPremium = :isPremium', { isPremium });
    }

    if (search) {
      queryBuilder.andWhere(
        '(problem.title ILIKE :search OR problem.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (topicIds && topicIds.length > 0) {
      queryBuilder.andWhere('topic.id IN (:...topicIds)', { topicIds });
    }

    if (tagIds && tagIds.length > 0) {
      queryBuilder.andWhere('tag.id IN (:...tagIds)', { tagIds });
    }

    const sortBy = filterDto.sortBy;
    const sortOrder = filterDto.sortOrder;
    queryBuilder.orderBy(`problem.${sortBy}`, sortOrder);
    queryBuilder.skip(filterDto.skip).take(filterDto.take);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResultDto(data, {
      page: filterDto.page ?? 1,
      limit: filterDto.limit ?? 20,
      total,
    });
  }

  async getProblemById(id: number): Promise<Problem> {
    const problem = await this.problemRepository.findOne({
      where: { id },
      relations: ['topics', 'tags', 'createdBy', 'updatedBy'],
    });

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return problem;
  }

  async getProblemBySlug(slug: string): Promise<Problem> {
    const problem = await this.problemRepository.findOne({
      where: { slug },
      relations: ['topics', 'tags'],
    });

    if (!problem) {
      throw new NotFoundException(`Problem with slug ${slug} not found`);
    }

    return problem;
  }

  @Transactional()
  async updateProblem(
    id: number,
    updateProblemDto: UpdateProblemDto,
    userId: number,
  ): Promise<Problem> {
    const problem = await this.getProblemById(id);

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
        const topics = await this.topicRepository.findBy({ id: In(topicIds) });
        problem.topics = topics;
      } else {
        problem.topics = [];
      }
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      if (tagIds.length > 0) {
        const tags = await this.tagRepository.findBy({ id: In(tagIds) });
        problem.tags = tags;
      } else {
        problem.tags = [];
      }
    }

    return this.problemRepository.save(problem);
  }

  @Transactional()
  async deleteProblem(id: number): Promise<void> {
    const problem = await this.getProblemById(id);
    await this.problemRepository.remove(problem);
  }

  @Transactional()
  async togglePublishProblem(id: number): Promise<Problem> {
    const problem = await this.getProblemById(id);
    problem.isPublished = !problem.isPublished;
    return this.problemRepository.save(problem);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  @Transactional()
  async updateProblemStats(problemId: number): Promise<void> {
    const problem = await this.getProblemById(problemId);

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

    // Only apply published/active filters if user doesn't have read_all permission
    if (!canReadAll) {
      queryBuilder
        .where('problem.isPublished = :isPublished', { isPublished: true })
        .andWhere('problem.isActive = :isActive', { isActive: true });
    }

    return queryBuilder.orderBy('RANDOM()').limit(count).getMany();
  }
}

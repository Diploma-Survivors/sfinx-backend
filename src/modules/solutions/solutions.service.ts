import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { PaginatedResultDto } from '../../common';
import { Solution } from './entities/solution.entity';
import {
  CreateSolutionDto,
  FilterSolutionDto,
  SolutionSortBy,
  UpdateSolutionDto,
} from './dto';
import { VoteType } from '../comments-base/enums';
import { ProgrammingLanguage } from '../programming-language';
import { Tag } from '../problems/entities/tag.entity';
import { Problem } from '../problems/entities/problem.entity';
import { StorageService } from '../storage/storage.service';
import { SolutionResponseDto } from './dto';
import { getAvatarUrl } from '../../common';
import { SolutionVotesService } from './services/solution-votes.service';

@Injectable()
export class SolutionsService {
  constructor(
    @InjectRepository(Solution)
    private readonly solutionRepo: Repository<Solution>,
    @InjectRepository(ProgrammingLanguage)
    private readonly languageRepo: Repository<ProgrammingLanguage>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly solutionVotesService: SolutionVotesService,
  ) {}

  private mapToResponseDto(
    solution: Solution,
    userVote: number | null = null,
  ): SolutionResponseDto {
    const dto = new SolutionResponseDto();
    dto.id = solution.id;
    dto.problemId = solution.problemId;
    dto.title = solution.title;
    dto.content = solution.content;
    dto.authorId = solution.authorId;
    dto.upvoteCount = solution.upvoteCount;
    dto.downvoteCount = solution.downvoteCount;
    dto.voteScore = solution.voteScore;
    dto.commentCount = solution.commentCount;
    dto.createdAt = solution.createdAt;
    dto.updatedAt = solution.updatedAt;
    dto.tags = solution.tags || [];
    dto.languageIds = solution.languages?.map((l) => l.id) || [];
    dto.userVote = userVote;

    if (solution.author) {
      dto.author = {
        id: solution.author.id,
        username: solution.author.username,
        isPremium: solution.author.isPremium,
        avatarUrl:
          getAvatarUrl(solution.author.avatarKey, this.storageService) ??
          undefined,
      };
    }

    return dto;
  }

  async create(
    userId: number,
    dto: CreateSolutionDto,
  ): Promise<SolutionResponseDto> {
    const problem = await this.problemRepo.findOneBy({ id: dto.problemId });
    if (!problem) throw new NotFoundException('Problem not found');

    const solution = this.solutionRepo.create({
      ...dto,
      authorId: userId,
      tags: dto.tagIds ? dto.tagIds.map((id) => ({ id }) as Tag) : [],
      languages: dto.languageIds
        ? dto.languageIds.map((id) => ({ id }) as ProgrammingLanguage)
        : [],
    });

    const saved = await this.solutionRepo.save(solution);
    // Reload to get relations
    return this.findOne(saved.id, userId);
  }

  async findAll(
    query: FilterSolutionDto,
    userId?: number,
  ): Promise<PaginatedResultDto<SolutionResponseDto>> {
    const qb = this.solutionRepo.createQueryBuilder('solution');

    qb.leftJoinAndSelect('solution.author', 'author')
      .leftJoinAndSelect('solution.tags', 'tags')
      .leftJoinAndSelect('solution.languages', 'languages');

    // Filter by Problem ID
    if (query.problemId) {
      qb.andWhere('solution.problemId = :problemId', {
        problemId: query.problemId,
      });
    }

    // Filter by Keyword (Title)
    if (query.keyword) {
      qb.andWhere('solution.title ILIKE :keyword', {
        keyword: `%${query.keyword}%`,
      });
    }

    // Filter by Tags
    if (query.tagIds && query.tagIds.length > 0) {
      qb.innerJoin(
        'solution.tags',
        'filterTags',
        'filterTags.id IN (:...tagIds)',
        { tagIds: query.tagIds },
      );
    }

    // Filter by Languages
    if (query.languageIds && query.languageIds.length > 0) {
      qb.innerJoin(
        'solution.languages',
        'filterLangs',
        'filterLangs.id IN (:...langIds)',
        { langIds: query.languageIds },
      );
    }

    // Sort
    if (query.sortBy === SolutionSortBy.MOST_VOTED) {
      qb.orderBy('solution.upvoteCount', 'DESC');
    } else {
      qb.orderBy('solution.createdAt', 'DESC');
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    let userVotesMap: Map<number, number> | null = null;
    if (userId) {
      const solutionIds = items.map((s) => s.id);
      userVotesMap = await this.solutionVotesService.getUserVotes(
        solutionIds,
        userId,
      );
    }

    const dtos = items.map((item) => {
      const userVote = userVotesMap
        ? (userVotesMap.get(item.id) ?? null)
        : null;
      return this.mapToResponseDto(item, userVote);
    });

    return new PaginatedResultDto(dtos, {
      page,
      limit,
      total,
    });
  }

  async findOne(id: number, userId?: number): Promise<SolutionResponseDto> {
    const solution = await this.solutionRepo.findOne({
      where: { id },
      relations: ['author', 'tags', 'languages', 'problem'],
    });

    if (!solution) throw new NotFoundException('Solution not found');

    let userVote: number | null = null;
    if (userId) {
      userVote = await this.solutionVotesService.getUserVote(id, userId);
    }

    return this.mapToResponseDto(solution, userVote);
  }

  async findAllByUser(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResultDto<SolutionResponseDto>> {
    const [items, total] = await this.solutionRepo.findAndCount({
      where: { authorId: userId },
      relations: ['author', 'tags', 'languages', 'problem'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const solutionIds = items.map((s) => s.id);
    const userVotesMap = await this.solutionVotesService.getUserVotes(
      solutionIds,
      userId,
    );

    const dtos = items.map((item) => {
      const userVote = userVotesMap.get(item.id) ?? null;
      return this.mapToResponseDto(item, userVote);
    });

    return new PaginatedResultDto(dtos, { page, limit, total });
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateSolutionDto,
  ): Promise<SolutionResponseDto> {
    const solution = await this.solutionRepo.findOne({
      where: { id },
    }); // Need just simple fetch first

    if (!solution) throw new NotFoundException('Solution not found');

    if (solution.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this solution',
      );
    }

    const updateData: DeepPartial<Solution> = {
      ...dto,
    } as DeepPartial<Solution>;
    if (dto.tagIds) {
      updateData.tags = dto.tagIds.map((id) => ({ id }) as Tag);
    }
    if (dto.languageIds) {
      updateData.languages = dto.languageIds.map(
        (id) => ({ id }) as ProgrammingLanguage,
      );
    }

    const updated = this.solutionRepo.merge(solution, updateData);
    await this.solutionRepo.save(updated);

    // Clean fetch for return
    return this.findOne(id, userId);
  }

  async remove(id: number, userId: number): Promise<void> {
    const solution = await this.solutionRepo.findOneBy({ id });
    if (!solution) throw new NotFoundException('Solution not found');

    if (solution.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this solution',
      );
    }

    await this.solutionRepo.remove(solution);
  }

  async voteSolution(
    solutionId: number,
    userId: number,
    voteType: VoteType,
  ): Promise<void> {
    await this.solutionVotesService.vote(solutionId, userId, voteType);
  }

  async unvoteSolution(solutionId: number, userId: number): Promise<void> {
    await this.solutionVotesService.unvote(solutionId, userId);
  }
}

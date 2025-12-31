import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, DeepPartial } from 'typeorm';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { Solution } from './entities/solution.entity';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';
import { FilterSolutionDto, SolutionSortBy } from './dto/filter-solution.dto';
import { VoteType } from '../comments-base/enums/vote-type.enum';
import { SolutionVote } from './entities/solution-vote.entity';
import { ProgrammingLanguage } from '../programming-language/entities/programming-language.entity';
import { Tag } from '../problems/entities/tag.entity';
import { Problem } from '../problems/entities/problem.entity';
// import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { SolutionResponseDto } from './dto/solution-response.dto';

@Injectable()
export class SolutionsService {
  constructor(
    @InjectRepository(Solution)
    private readonly solutionRepo: Repository<Solution>,
    @InjectRepository(SolutionVote)
    private readonly solutionVoteRepo: Repository<SolutionVote>,
    @InjectRepository(ProgrammingLanguage)
    private readonly languageRepo: Repository<ProgrammingLanguage>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private getAvatarUrl(avatarKey: string | null): string | undefined {
    if (!avatarKey) return undefined;
    if (avatarKey.startsWith('http')) return avatarKey;
    return this.storageService.getCloudFrontUrl(avatarKey);
  }

  private mapToResponseDto(
    solution: Solution,
    voteType: 'up_vote' | 'down_vote' | null = null,
  ): SolutionResponseDto {
    const dto = new SolutionResponseDto();
    dto.id = solution.id;
    dto.problemId = solution.problemId;
    dto.title = solution.title;
    dto.content = solution.content;
    dto.authorId = solution.authorId;
    dto.upvoteCount = solution.upvoteCount;
    dto.downvoteCount = solution.downvoteCount;
    dto.commentCount = solution.commentCount;
    dto.createdAt = solution.createdAt;
    dto.updatedAt = solution.updatedAt;
    dto.tags = solution.tags || [];
    dto.languageIds = solution.languages?.map((l) => l.id) || [];
    dto.myVote = voteType;

    if (solution.author) {
      dto.author = {
        id: solution.author.id,
        username: solution.author.username,
        isPremium: solution.author.isPremium,
        avatarUrl: this.getAvatarUrl(solution.author.avatarKey),
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

    const dtos = await Promise.all(
      items.map(async (item) => {
        let voteType: 'up_vote' | 'down_vote' | null = null;
        if (userId) {
          const vote = await this.solutionVoteRepo.findOne({
            where: { solutionId: item.id, userId },
          });
          voteType = vote
            ? vote.voteType === VoteType.UPVOTE
              ? 'up_vote'
              : 'down_vote'
            : null;
        }
        return this.mapToResponseDto(item, voteType);
      }),
    );

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

    let voteType: 'up_vote' | 'down_vote' | null = null;
    if (userId) {
      const vote = await this.solutionVoteRepo.findOne({
        where: { solutionId: id, userId },
      });
      voteType = vote
        ? vote.voteType === VoteType.UPVOTE
          ? 'up_vote'
          : 'down_vote'
        : null;
    }

    return this.mapToResponseDto(solution, voteType);
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

    const dtos = await Promise.all(
      items.map(async (item) => {
        let voteType: 'up_vote' | 'down_vote' | null = null;
        const vote = await this.solutionVoteRepo.findOne({
          where: { solutionId: item.id, userId },
        });
        voteType = vote
          ? vote.voteType === VoteType.UPVOTE
            ? 'up_vote'
            : 'down_vote'
          : null;
        return this.mapToResponseDto(item, voteType);
      }),
    );

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
    type: 'up_vote' | 'down_vote',
  ): Promise<void> {
    const voteType = type === 'up_vote' ? VoteType.UPVOTE : VoteType.DOWNVOTE;

    const existingVote = await this.solutionVoteRepo.findOne({
      where: { solutionId, userId },
    });

    await this.dataSource.transaction(async (manager) => {
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // remove vote (toggle off)
          await manager.delete(SolutionVote, { solutionId, userId });
          await this.updateSolutionVoteCounts(manager, solutionId);
        } else {
          // change vote
          existingVote.voteType = voteType;
          await manager.save(existingVote);
          await this.updateSolutionVoteCounts(manager, solutionId);
        }
      } else {
        // new vote
        const newVote = this.solutionVoteRepo.create({
          solutionId,
          userId,
          voteType,
        });
        await manager.save(newVote);
        await this.updateSolutionVoteCounts(manager, solutionId);
      }
    });
  }

  async unvoteSolution(solutionId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SolutionVote, { solutionId, userId });
      await this.updateSolutionVoteCounts(manager, solutionId);
    });
  }

  private async updateSolutionVoteCounts(
    manager: EntityManager,
    solutionId: number,
  ) {
    const upvotes = await manager.count(SolutionVote, {
      where: { solutionId, voteType: VoteType.UPVOTE },
    });
    const downvotes = await manager.count(SolutionVote, {
      where: { solutionId, voteType: VoteType.DOWNVOTE },
    });
    await manager.update(Solution, solutionId, {
      upvoteCount: upvotes,
      downvoteCount: downvotes,
    });
  }
}

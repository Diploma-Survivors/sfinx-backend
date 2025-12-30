import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { Solution } from './entities/solution.entity';
import { SolutionComment } from './entities/solution-comment.entity';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';
import { FilterSolutionDto, SolutionSortBy } from './dto/filter-solution.dto';
import { VoteType } from './enums/vote-type.enum';
import { SolutionVote } from './entities/solution-vote.entity';
import { SolutionCommentVote } from './entities/solution-comment-vote.entity';
import { CreateSolutionCommentDto } from './dto/create-solution-comment.dto';
import { UpdateSolutionCommentDto } from './dto/update-solution-comment.dto';
import { ProgrammingLanguage } from '../programming-language/entities/programming-language.entity';
import { Tag } from '../problems/entities/tag.entity';
import { Problem } from '../problems/entities/problem.entity';
// import { User } from '../auth/entities/user.entity';

@Injectable()
export class SolutionsService {
  constructor(
    @InjectRepository(Solution)
    private readonly solutionRepo: Repository<Solution>,
    @InjectRepository(SolutionComment)
    private readonly commentRepo: Repository<SolutionComment>,
    @InjectRepository(SolutionVote)
    private readonly solutionVoteRepo: Repository<SolutionVote>,
    @InjectRepository(SolutionCommentVote)
    private readonly commentVoteRepo: Repository<SolutionCommentVote>,
    @InjectRepository(ProgrammingLanguage)
    private readonly languageRepo: Repository<ProgrammingLanguage>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: number, dto: CreateSolutionDto): Promise<Solution> {
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

    return this.solutionRepo.save(solution);
  }

  async findAll(
    query: FilterSolutionDto,
    userId?: number,
  ): Promise<PaginatedResultDto<Solution>> {
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

    // Populate myVote and map languageIds manually or via transformation
    // Here we map languageIds for DTO compatibility
    const itemsWithVote = await Promise.all(
      items.map(async (item) => {
        const solutionItem = item;

        (solutionItem as any).languageIds =
          solutionItem.languages?.map((l) => l.id) || [];

        if (userId) {
          const vote = await this.solutionVoteRepo.findOne({
            where: { solutionId: solutionItem.id, userId },
          });
          solutionItem.myVote = vote
            ? vote.voteType === VoteType.UPVOTE
              ? 'up_vote'
              : 'down_vote'
            : null;
        } else {
          solutionItem.myVote = null;
        }
        return solutionItem;
      }),
    );

    return new PaginatedResultDto(itemsWithVote, {
      page,
      limit,
      total,
    });
  }

  async findOne(id: number, userId?: number): Promise<Solution> {
    const solution = await this.solutionRepo.findOne({
      where: { id },
      relations: ['author', 'tags', 'languages', 'problem'],
    });

    if (!solution) throw new NotFoundException('Solution not found');

    // Map languageIds
    // Map languageIds

    (solution as any).languageIds = solution.languages?.map((l) => l.id) || [];

    if (userId) {
      const vote = await this.solutionVoteRepo.findOne({
        where: { solutionId: id, userId },
      });
      solution.myVote = vote
        ? vote.voteType === VoteType.UPVOTE
          ? 'up_vote'
          : 'down_vote'
        : null;
    }

    return solution;
  }

  async findAllByUser(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResultDto<Solution>> {
    const [items, total] = await this.solutionRepo.findAndCount({
      where: { authorId: userId },
      relations: ['author', 'tags', 'languages', 'problem'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Process items like findAll
    const itemsWithVote = items.map((item) => {
      (item as any).languageIds = item.languages?.map((l) => l.id) || [];
      // Since we are fetching my own solutions, I might have voted on them? Unlikely in some logic, but possible.
      // Assuming user can vote on their own solution, we normally check.
      // But optimization: we can fetch votes. For now, strict 'myVote' logic requires checking.
      // Or leave null if we don't care about myVote on my own profile list?
      // Let's implement consistent check.
      return item;
    });

    // populate myVote
    for (const item of itemsWithVote) {
      const vote = await this.solutionVoteRepo.findOne({
        where: { solutionId: item.id, userId },
      });
      item.myVote = vote
        ? vote.voteType === VoteType.UPVOTE
          ? 'up_vote'
          : 'down_vote'
        : null;
    }

    return new PaginatedResultDto(itemsWithVote, { page, limit, total });
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateSolutionDto,
  ): Promise<Solution> {
    const solution = await this.findOne(id);

    if (solution.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this solution',
      );
    }

    const updateData: any = { ...dto };
    if (dto.tagIds) {
      updateData.tags = dto.tagIds.map((id) => ({ id }));
    }
    if (dto.languageIds) {
      updateData.languages = dto.languageIds.map((id) => ({ id }));
    }

    const updated = this.solutionRepo.merge(solution, updateData);
    return this.solutionRepo.save(updated);
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

  // Comments Logic
  async getComments(
    solutionId: number,
    userId?: number,
  ): Promise<SolutionComment[]> {
    const comments = await this.commentRepo.find({
      where: { solutionId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    const hydrated = await Promise.all(
      comments.map(async (c) => {
        (c as any).replyCounts = c.replyCount;
        if (userId) {
          const vote = await this.commentVoteRepo.findOne({
            where: { commentId: c.id, userId },
          });
          c.myVote = vote
            ? vote.voteType === VoteType.UPVOTE
              ? 'up_vote'
              : 'down_vote'
            : null;
        }
        return c;
      }),
    );

    return hydrated;
  }

  async createComment(
    userId: number,
    solutionId: number,
    dto: CreateSolutionCommentDto,
  ): Promise<SolutionComment> {
    const comment = this.commentRepo.create({
      ...dto,
      authorId: userId,
      solutionId,
      parentId: dto.parentId || null,
    });

    const saved = await this.commentRepo.save(comment);

    if (saved.parentId) {
      await this.commentRepo.increment({ id: saved.parentId }, 'replyCount', 1);
    }

    const solution = await this.solutionRepo.findOneBy({ id: solutionId });
    if (solution) {
      await this.solutionRepo.increment({ id: solutionId }, 'commentCount', 1);
    }

    const createdComment = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    if (!createdComment) {
      throw new NotFoundException('Comment not found after creation');
    }
    return createdComment;
  }

  async updateComment(
    id: number,
    userId: number,
    dto: UpdateSolutionCommentDto,
  ): Promise<SolutionComment> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this comment',
      );
    }

    comment.content = dto.content;
    return this.commentRepo.save(comment);
  }

  async deleteComment(id: number, userId: number): Promise<void> {
    const comment = await this.commentRepo.findOneBy({ id });
    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this comment',
      );
    }

    // Decrement parent reply count
    if (comment.parentId) {
      await this.commentRepo.decrement(
        { id: comment.parentId },
        'replyCount',
        1,
      );
    }
    // Decrement solution comment count
    await this.solutionRepo.decrement(
      { id: comment.solutionId },
      'commentCount',
      1,
    );

    await this.commentRepo.remove(comment);
  }

  async voteComment(
    commentId: number,
    userId: number,
    type: 'up_vote' | 'down_vote',
  ): Promise<void> {
    const voteType = type === 'up_vote' ? VoteType.UPVOTE : VoteType.DOWNVOTE;
    const existingVote = await this.commentVoteRepo.findOne({
      where: { commentId, userId },
    });

    await this.dataSource.transaction(async (manager) => {
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          await manager.delete(SolutionCommentVote, { commentId, userId });
          await this.updateCommentVoteCounts(manager, commentId);
        } else {
          existingVote.voteType = voteType;
          await manager.save(existingVote);
          await this.updateCommentVoteCounts(manager, commentId);
        }
      } else {
        const newVote = this.commentVoteRepo.create({
          commentId,
          userId,
          voteType,
        });
        await manager.save(newVote);
        await this.updateCommentVoteCounts(manager, commentId);
      }
    });
  }

  async unvoteComment(commentId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SolutionCommentVote, { commentId, userId });
      await this.updateCommentVoteCounts(manager, commentId);
    });
  }

  private async updateCommentVoteCounts(
    manager: EntityManager,
    commentId: number,
  ) {
    const upvotes = await manager.count(SolutionCommentVote, {
      where: { commentId, voteType: VoteType.UPVOTE },
    });
    const downvotes = await manager.count(SolutionCommentVote, {
      where: { commentId, voteType: VoteType.DOWNVOTE },
    });
    await manager.update(SolutionComment, commentId, {
      upvoteCount: upvotes,
      downvoteCount: downvotes,
    });
  }
}

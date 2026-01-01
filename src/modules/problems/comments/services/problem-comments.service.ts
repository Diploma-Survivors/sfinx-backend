import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import {
  getAvatarUrl,
  MarkdownService,
  PaginatedResultDto,
  SortOrder,
} from '../../../../common';
import { StorageService } from '../../../storage/storage.service';
import {
  AuthorDto,
  ProblemCommentResponseDto,
  CommentSortBy,
  CreateCommentDto,
  FilterCommentDto,
  UpdateCommentDto,
} from '../dto';
import { ProblemComment, ProblemCommentVote } from '../entities';
import { VoteType } from '../enums';
import { BaseCommentsService } from '../../../comments-base/base-comments.service';

import { VoteResponseDto } from '../dto';

@Injectable()
export class ProblemCommentsService extends BaseCommentsService<
  ProblemComment,
  ProblemCommentVote,
  CreateCommentDto,
  UpdateCommentDto
> {
  constructor(
    @InjectRepository(ProblemComment)
    commentRepo: Repository<ProblemComment>,
    @InjectRepository(ProblemCommentVote)
    voteRepo: Repository<ProblemCommentVote>,
    private readonly markdownService: MarkdownService,
    storageService: StorageService,
    dataSource: DataSource,
  ) {
    super(commentRepo, voteRepo, storageService, dataSource);
  }

  protected getCommentEntityName(): string {
    return ProblemComment.name;
  }

  protected getVoteEntityName(): string {
    return ProblemCommentVote.name;
  }

  protected createVoteEntity(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): ProblemCommentVote {
    const vote = new ProblemCommentVote();
    vote.commentId = commentId;
    vote.userId = userId;
    vote.voteType = voteType;
    return vote;
  }

  protected getParentRelationIdField(): string {
    return 'problemId';
  }

  protected async updateCommentVoteCounts(
    manager: EntityManager,
    commentId: number,
  ) {
    // Call super to update upvote/downvote counts
    await super.updateCommentVoteCounts(manager, commentId);

    // Update voteScore (specific to Problem Comment)
    const upvotes = await manager.getRepository(ProblemCommentVote).count({
      where: { commentId, voteType: VoteType.UPVOTE },
    });
    const downvotes = await manager.getRepository(ProblemCommentVote).count({
      where: { commentId, voteType: VoteType.DOWNVOTE },
    });
    await manager.update(ProblemComment, commentId, {
      voteScore: upvotes - downvotes,
    });
  }

  @Transactional()
  async voteProblemComment(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): Promise<VoteResponseDto> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment)
      throw new NotFoundException(`Comment with ID ${commentId} not found`);

    const existingVote = await this.voteRepo.findOne({
      where: { commentId, userId },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // No change
      } else {
        // Update
        existingVote.voteType = voteType;
        await this.voteRepo.save(existingVote);
        await this.updateCommentVoteCounts(this.commentRepo.manager, commentId);
      }
    } else {
      // New
      const newVote = this.createVoteEntity(commentId, userId, voteType);
      await this.voteRepo.save(newVote);
      await this.updateCommentVoteCounts(this.commentRepo.manager, commentId);
    }

    const updated = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    return {
      voteType,
      upvoteCount: updated!.upvoteCount,
      downvoteCount: updated!.downvoteCount,
      voteScore: updated!.voteScore,
    };
  }

  async removeVote(commentId: number, userId: number): Promise<void> {
    return this.unvoteComment(commentId, userId);
  }

  // Override create to add validation and extra fields
  @Transactional()
  async createComment(
    userId: number,
    problemId: number,
    dto: CreateCommentDto,
  ): Promise<ProblemCommentResponseDto> {
    const validation = this.markdownService.validateMarkdown(dto.content);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Invalid markdown content',
        errors: validation.errors,
      });
    }

    if (dto.parentId) {
      const parentComment = await this.commentRepo.findOne({
        where: { id: dto.parentId },
      });

      if (!parentComment) {
        throw new NotFoundException(
          `Parent comment with ID ${dto.parentId} not found`,
        );
      }
    }

    const extraFields = {
      type: dto.type,
    };

    // Call super
    const result = await super.createComment(
      userId,
      problemId,
      dto,
      extraFields,
    );

    return result as ProblemCommentResponseDto;
  }

  // Override update for validation
  @Transactional()
  async updateComment(
    id: number,
    userId: number,
    dto: UpdateCommentDto,
  ): Promise<ProblemCommentResponseDto> {
    if (dto.content !== undefined) {
      const validation = this.markdownService.validateMarkdown(dto.content);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Invalid markdown content',
          errors: validation.errors,
        });
      }
    }

    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!comment)
      throw new NotFoundException(`Comment with ID ${id} not found`);
    if (comment.isDeleted)
      throw new ForbiddenException('Cannot edit a deleted comment');
    if (comment.authorId !== userId)
      throw new ForbiddenException('You can only edit your own comments');

    // Apply updates locally as super update is basic
    if (dto.content !== undefined) comment.content = dto.content;
    if (dto.type !== undefined) comment.type = dto.type;

    comment.isEdited = true;
    comment.editedAt = new Date();

    const saved = await this.commentRepo.save(comment);
    return this.mapToResponseDto(saved);
  }

  @Transactional()
  async deleteComment(
    id: number,
    userId: number,
    isAdmin = false,
  ): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    if (!isAdmin && comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    comment.isDeleted = true;
    // comment.content = '[Deleted]'; // Optional
    await this.commentRepo.save(comment);
  }

  // Optimized batch fetch of votes
  async getUserVotes(
    commentIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    if (commentIds.length === 0) return new Map();

    const votes = await this.voteRepo.find({
      where: {
        commentId: In(commentIds),
        userId,
      },
      select: ['commentId', 'voteType'],
    });

    const map = new Map<number, number>();
    votes.forEach((v) => map.set(v.commentId, v.voteType as unknown as number)); // Cast enum
    return map;
  }

  async getPaginatedComments(
    filterDto: FilterCommentDto,
    userId?: number,
  ): Promise<PaginatedResultDto<ProblemCommentResponseDto>> {
    const { skip, take, problemId, type, parentId, sortBy } = filterDto;

    const queryBuilder = this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author');

    if (problemId)
      queryBuilder.andWhere('comment.problem_id = :problemId', { problemId });
    if (type) queryBuilder.andWhere('comment.type = :type', { type });

    if (!parentId) queryBuilder.andWhere('comment.parent_id IS NULL');
    else queryBuilder.andWhere('comment.parent_id = :parentId', { parentId });

    switch (sortBy) {
      case CommentSortBy.NEWEST:
        queryBuilder.orderBy('comment.createdAt', SortOrder.DESC);
        break;
      case CommentSortBy.OLDEST:
        queryBuilder.orderBy('comment.createdAt', SortOrder.ASC);
        break;
      case CommentSortBy.TOP:
      default:
        queryBuilder
          .orderBy('comment.isPinned', SortOrder.DESC)
          .addOrderBy('comment.voteScore', SortOrder.DESC)
          .addOrderBy('comment.createdAt', SortOrder.DESC);
        break;
    }

    queryBuilder.skip(skip).take(take);
    const [comments, total] = await queryBuilder.getManyAndCount();

    let userVotes: Map<number, number> | null = null;
    if (userId) {
      const ids = comments.map((c) => c.id);
      userVotes = await this.getUserVotes(ids, userId);
    }

    const items = comments.map((c) => this.mapToResponseDto(c, userVotes));

    return new PaginatedResultDto(items, {
      page: filterDto.page ?? 1,
      limit: filterDto.limit ?? 20,
      total,
    });
  }

  async getCommentById(
    id: number,
    userId?: number,
  ): Promise<ProblemCommentResponseDto> {
    // 1. Fetch the comment and all its descendants using recursive CTE
    const query = `
      WITH RECURSIVE comment_tree AS (
        SELECT * FROM problem_comments WHERE id = $1
        UNION ALL
        SELECT c.* FROM problem_comments c
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
      )
      SELECT * FROM comment_tree ORDER BY created_at ASC;
    `;

    const rawComments: any[] = await this.dataSource.query(query, [id]);

    // 2. Hydrate entities with Author relations (since raw query doesn't bring relations easily)
    // Or fetch IDs and then find with TypeORM
    interface RawComment {
      id: number;
    }
    const ids = (rawComments as RawComment[]).map((c) => c.id);
    if (ids.length === 0) throw new NotFoundException('Comment not found');

    const comments = await this.commentRepo.find({
      where: { id: In(ids) },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    // 3. Get User Votes for these comments
    let userVotes: Map<number, number> | null = null;
    if (userId) {
      userVotes = await this.getUserVotes(ids, userId);
    }

    // 4. Build Tree
    const commentMap = new Map<number, ProblemCommentResponseDto>();
    comments.forEach((c) => {
      const dto = this.mapToResponseDto(c, userVotes);
      dto.replies = [];
      commentMap.set(c.id, dto);
    });

    let rootDto: ProblemCommentResponseDto | null = null;

    comments.forEach((c) => {
      const dto = commentMap.get(c.id)!;
      if (c.id === id) {
        rootDto = dto;
      } else {
        if (c.parentId && commentMap.has(c.parentId)) {
          commentMap.get(c.parentId)!.replies!.push(dto);
        }
      }
    });

    if (!rootDto) throw new NotFoundException('Comment not found');
    return rootDto;
  }

  async buildCommentTree(
    problemId: number,
    userId?: number,
  ): Promise<ProblemCommentResponseDto[]> {
    const allComments = await this.commentRepo.find({
      where: { problemId },
      relations: ['author'],
      order: {
        isPinned: SortOrder.DESC,
        voteScore: SortOrder.DESC,
        createdAt: SortOrder.DESC,
      },
    });

    let userVotes: Map<number, number> | null = null;
    if (userId) {
      const ids = allComments.map((c) => c.id);
      userVotes = await this.getUserVotes(ids, userId);
    }

    const commentMap = new Map<number, ProblemCommentResponseDto>();
    allComments.forEach((comment) => {
      const dto = this.mapToResponseDto(comment, userVotes);
      dto.replies = [];
      commentMap.set(comment.id, dto);
    });

    const rootComments: ProblemCommentResponseDto[] = [];
    allComments.forEach((comment) => {
      const commentDto = commentMap.get(comment.id)!;
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies!.push(commentDto);
        }
      } else {
        rootComments.push(commentDto);
      }
    });

    return rootComments;
  }

  @Transactional()
  async pinComment(id: number): Promise<ProblemCommentResponseDto> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!comment)
      throw new NotFoundException(`Comment with ID ${id} not found`);
    comment.isPinned = true;
    const updated = await this.commentRepo.save(comment);
    return this.mapToResponseDto(updated);
  }

  @Transactional()
  async unpinComment(id: number): Promise<ProblemCommentResponseDto> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!comment)
      throw new NotFoundException(`Comment with ID ${id} not found`);
    comment.isPinned = false;
    const updated = await this.commentRepo.save(comment);
    return this.mapToResponseDto(updated);
  }

  protected mapToResponseDto(
    comment: ProblemComment,
    userVotes?: Map<number, number> | null,
  ): ProblemCommentResponseDto {
    const author: AuthorDto = {
      id: comment.author?.id,
      username: comment.author?.username,
      avatarUrl:
        getAvatarUrl(comment.author?.avatarKey, this.storageService) ??
        undefined,
      isPremium: comment.author?.isPremium,
    };

    return {
      id: comment.id,
      problemId: comment.problemId,
      parentId: comment.parentId,
      content: comment.content,
      type: comment.type,
      isPinned: comment.isPinned,
      isEdited: comment.isEdited,
      isDeleted: comment.isDeleted,
      upvoteCount: comment.upvoteCount,
      downvoteCount: comment.downvoteCount,
      voteScore: comment.voteScore,
      replyCount: comment.replyCount,
      reportCount: comment.reportCount,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author,
      userVote: userVotes ? (userVotes.get(comment.id) ?? null) : null,
    };
  }
}

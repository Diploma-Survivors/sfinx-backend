import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import {
  MarkdownService,
  PaginatedResultDto,
  SortOrder,
} from '../../../../common';
import { StorageService } from '../../../storage/storage.service';
import {
  CommentAuthorDto,
  CommentResponseDto,
  CommentSortBy,
  CreateCommentDto,
  FilterCommentDto,
  UpdateCommentDto,
} from '../dto';
import { Comment } from '../entities';
import { CommentVotesService } from './comment-votes.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly votesService: CommentVotesService,
    private readonly markdownService: MarkdownService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Create a new comment
   */
  @Transactional()
  async createComment(
    dto: CreateCommentDto,
    userId: number,
  ): Promise<CommentResponseDto> {
    // Validate markdown content
    const validation = this.markdownService.validateMarkdown(dto.content);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Invalid markdown content',
        errors: validation.errors,
      });
    }

    // If replying to a parent comment, verify it exists
    if (dto.parentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: dto.parentId },
      });

      if (!parentComment) {
        throw new NotFoundException(
          `Parent comment with ID ${dto.parentId} not found`,
        );
      }

      // Increment parent's reply count
      await this.commentRepository
        .createQueryBuilder()
        .update(Comment)
        .set({
          replyCount: () => 'reply_count + 1',
        })
        .where('id = :id', { id: dto.parentId })
        .execute();
    }

    // Create comment
    const comment = this.commentRepository.create({
      problemId: dto.problemId,
      userId,
      parentId: dto.parentId ?? null,
      content: dto.content,
      type: dto.type,
    });

    const savedComment = await this.commentRepository.save(comment);

    // Fetch with author relation
    const fullComment = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['author'],
    });

    return this.mapToResponseDto(fullComment!);
  }

  /**
   * Update a comment
   */
  @Transactional()
  async updateComment(
    id: number,
    dto: UpdateCommentDto,
    userId: number,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    // Ownership check
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // Check if already deleted
    if (comment.isDeleted) {
      throw new ForbiddenException('Cannot edit a deleted comment');
    }

    // Validate markdown if content is being updated
    if (dto.content !== undefined) {
      const validation = this.markdownService.validateMarkdown(dto.content);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Invalid markdown content',
          errors: validation.errors,
        });
      }
      comment.content = dto.content;
    }
    if (dto.type !== undefined) {
      comment.type = dto.type;
    }

    // Mark as edited
    comment.isEdited = true;
    comment.editedAt = new Date();

    const updated = await this.commentRepository.save(comment);

    return this.mapToResponseDto(updated);
  }

  /**
   * Soft delete a comment
   */
  @Transactional()
  async deleteComment(
    id: number,
    userId: number,
    isAdmin = false,
  ): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    // Ownership check (unless admin)
    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Soft delete: set isDeleted flag and replace content
    comment.isDeleted = true;

    await this.commentRepository.save(comment);
  }

  /**
   * Get paginated comments with filtering
   */
  async getComments(
    filterDto: FilterCommentDto,
    userId?: number,
  ): Promise<PaginatedResultDto<CommentResponseDto>> {
    const { skip, take, problemId, type, parentId, sortBy } = filterDto;

    const queryBuilder = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author');

    // Filters
    if (problemId) {
      queryBuilder.andWhere('comment.problem_id = :problemId', { problemId });
    }

    if (type) {
      queryBuilder.andWhere('comment.type = :type', { type });
    }

    if (!parentId) {
      // Top-level comments only
      queryBuilder.andWhere('comment.parent_id IS NULL');
    } else {
      queryBuilder.andWhere('comment.parent_id = :parentId', { parentId });
    }

    // Sorting
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

    // Fetch user votes if authenticated
    let userVotes: Map<number, number> | null = null;
    if (userId) {
      const commentIds = comments.map((c) => c.id);
      userVotes = await this.votesService.getUserVotes(commentIds, userId);
    }

    const items = comments.map((comment) =>
      this.mapToResponseDto(comment, userVotes),
    );

    return new PaginatedResultDto(items, {
      page: filterDto.page ?? 1,
      limit: filterDto.limit ?? 20,
      total,
    });
  }

  /**
   * Get comment by ID with nested replies
   */
  async getCommentById(
    id: number,
    userId?: number,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    // Fetch user vote if authenticated
    let userVote: number | null = null;
    if (userId) {
      userVote = await this.votesService.getUserVote(id, userId);
    }

    return this.mapToResponseDto(
      comment,
      userVote ? new Map([[id, userVote]]) : null,
    );
  }

  /**
   * Build comment tree for a problem (all comments in-memory tree)
   */
  async buildCommentTree(
    problemId: number,
    userId?: number,
  ): Promise<CommentResponseDto[]> {
    // Fetch all comments for the problem
    const allComments = await this.commentRepository.find({
      where: { problemId },
      relations: ['author'],
      order: {
        isPinned: SortOrder.DESC,
        voteScore: SortOrder.DESC,
        createdAt: SortOrder.DESC,
      },
    });

    // Fetch user votes if authenticated
    let userVotes: Map<number, number> | null = null;
    if (userId) {
      const commentIds = allComments.map((c) => c.id);
      userVotes = await this.votesService.getUserVotes(commentIds, userId);
    }

    // Build map: commentId -> CommentResponseDto with replies array
    const commentMap = new Map<number, CommentResponseDto>();
    allComments.forEach((comment) => {
      const dto = this.mapToResponseDto(comment, userVotes);
      dto.replies = [];
      commentMap.set(comment.id, dto);
    });

    // Build tree structure
    const rootComments: CommentResponseDto[] = [];
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

  /**
   * Pin a comment (admin only)
   */
  @Transactional()
  async pinComment(id: number): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    comment.isPinned = true;
    const updated = await this.commentRepository.save(comment);

    return this.mapToResponseDto(updated);
  }

  /**
   * Unpin a comment (admin only)
   */
  @Transactional()
  async unpinComment(id: number): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    comment.isPinned = false;
    const updated = await this.commentRepository.save(comment);

    return this.mapToResponseDto(updated);
  }

  /**
   * Map Comment entity to CommentResponseDto
   */
  private mapToResponseDto(
    comment: Comment,
    userVotes?: Map<number, number> | null,
  ): CommentResponseDto {
    const author: CommentAuthorDto = {
      id: comment.author.id,
      username: comment.author.username,
      avatarUrl: this.getAvatarUrl(comment.author.avatarKey) ?? undefined,
      isPremium: comment.author.isPremium,
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
      userVote: userVotes?.get(comment.id) ?? null,
    };
  }

  /**
   * Transform avatarKey to CloudFront URL
   */
  private getAvatarUrl(avatarKey: string | null | undefined): string | null {
    if (!avatarKey) return null;

    // Check if it's already a full URL (legacy data)
    if (avatarKey.startsWith('http://') || avatarKey.startsWith('https://')) {
      return avatarKey;
    }

    // Transform S3 key to CloudFront URL
    return this.storageService.getCloudFrontUrl(avatarKey);
  }
}

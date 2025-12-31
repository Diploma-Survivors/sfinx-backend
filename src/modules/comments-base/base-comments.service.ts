import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  Repository,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  FindOptionsOrder,
  DeepPartial,
  FindOneOptions,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BaseComment } from './entities/base-comment.entity';
import { BaseCommentVote } from './entities/base-comment-vote.entity';
import { StorageService } from '../storage/storage.service';

import { BaseCreateCommentDto } from './dto/base-create-comment.dto';
import { BaseUpdateCommentDto } from './dto/base-update-comment.dto';
import { BaseCommentResponseDto } from './dto/base-comment-response.dto';
import { AuthorDto } from '../users/dtos/author.dto';
import { VoteType } from './enums/vote-type.enum';
import { getAvatarUrl } from '../../common/utils';

export abstract class BaseCommentsService<
  CommentEntity extends BaseComment,
  VoteEntity extends BaseCommentVote,
  CreateDto extends BaseCreateCommentDto = BaseCreateCommentDto,
  UpdateDto extends BaseUpdateCommentDto = BaseUpdateCommentDto,
> {
  constructor(
    protected readonly commentRepo: Repository<CommentEntity>,
    protected readonly voteRepo: Repository<VoteEntity>,
    protected readonly storageService: StorageService,
    protected readonly dataSource: DataSource,
  ) {}

  protected abstract getCommentEntityName(): string;
  protected abstract getVoteEntityName(): string;
  protected abstract createVoteEntity(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): VoteEntity;

  // Helper to get relation ID column name (e.g., 'solution_id' or 'problem_id')
  protected abstract getParentRelationIdField(): string;

  async getComments(
    containerId: number, // problemId or solutionId
    userId?: number,
  ): Promise<BaseCommentResponseDto[]> {
    const relationField = this.getParentRelationIdField();

    const comments = await this.commentRepo.find({
      where: {
        [relationField]: containerId,
      } as unknown as FindOptionsWhere<CommentEntity>,
      relations: ['author'],
      order: { createdAt: 'ASC' } as unknown as FindOptionsOrder<CommentEntity>,
    });

    return Promise.all(
      comments.map(async (c) => {
        if (userId) {
          const vote = await this.voteRepo
            .createQueryBuilder('vote')
            .where(`vote.commentId = :commentId`, { commentId: c.id })
            .andWhere(`vote.userId = :userId`, { userId })
            .getOne();

          c.myVote = vote
            ? vote.voteType === VoteType.UPVOTE
              ? 'up_vote'
              : 'down_vote'
            : null;
        }
        return this.mapToResponseDto(c);
      }),
    );
  }

  async createComment(
    userId: number,
    containerId: number,
    dto: CreateDto,
    extraFields: Partial<CommentEntity> = {},
  ): Promise<BaseCommentResponseDto> {
    const relationField = this.getParentRelationIdField();

    const comment = this.commentRepo.create({
      ...dto,
      authorId: userId,
      [relationField]: containerId,
      parentId: dto.parentId || null,
      ...extraFields,
    } as unknown as DeepPartial<CommentEntity>);

    const saved = (await this.commentRepo.save(
      comment,
    )) as unknown as CommentEntity;

    if (saved.parentId) {
      await this.commentRepo
        .createQueryBuilder()
        .update()
        .set({
          replyCount: () => 'reply_count + 1',
        } as unknown as QueryDeepPartialEntity<CommentEntity>)
        .where('id = :id', { id: saved.parentId })
        .execute();
    }

    const createdComment = await this.commentRepo.findOne({
      where: { id: saved.id } as FindOptionsWhere<CommentEntity>,
      relations: ['author'],
    } as FindOneOptions<CommentEntity>);

    if (!createdComment) {
      throw new NotFoundException('Comment not found after creation');
    }
    return this.mapToResponseDto(createdComment);
  }

  async updateComment(
    id: number,
    userId: number,
    dto: UpdateDto,
  ): Promise<BaseCommentResponseDto> {
    const comment = await this.commentRepo.findOne({
      where: { id } as FindOptionsWhere<CommentEntity>,
      relations: ['author'],
    } as FindOneOptions<CommentEntity>);

    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this comment',
      );
    }

    if (dto.content) {
      comment.content = dto.content;
    }

    const saved = await this.commentRepo.save(comment);
    return this.mapToResponseDto(saved);
  }

  async deleteComment(id: number, userId: number): Promise<void> {
    const comment = await this.commentRepo.findOneBy({
      id,
    } as unknown as FindOptionsWhere<CommentEntity>);
    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this comment',
      );
    }

    if (comment.parentId) {
      await this.commentRepo
        .createQueryBuilder()
        .update()
        .set({
          replyCount: () => 'reply_count - 1',
        } as unknown as QueryDeepPartialEntity<CommentEntity>)
        .where('id = :id', { id: comment.parentId })
        .execute();
    }

    await this.commentRepo.remove(comment);
  }

  async voteComment(
    commentId: number,
    userId: number,
    type: 'up_vote' | 'down_vote',
  ): Promise<void> {
    const voteType = type === 'up_vote' ? VoteType.UPVOTE : VoteType.DOWNVOTE;

    const existingVote = await this.voteRepo
      .createQueryBuilder('vote')
      .where('vote.commentId = :commentId', { commentId })
      .andWhere('vote.userId = :userId', { userId })
      .getOne();

    await this.dataSource.transaction(async (manager) => {
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          await manager.getRepository(this.getVoteEntityName()).delete({
            commentId,
            userId,
          } as unknown as FindOptionsWhere<VoteEntity>);
          await this.updateCommentVoteCounts(manager, commentId);
        } else {
          existingVote.voteType = voteType;
          await manager.save(existingVote);
          await this.updateCommentVoteCounts(manager, commentId);
        }
      } else {
        const newVote = this.createVoteEntity(commentId, userId, voteType);
        await manager.save(newVote);
        await this.updateCommentVoteCounts(manager, commentId);
      }
    });
  }

  async unvoteComment(commentId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(this.getVoteEntityName()).delete({
        commentId,
        userId,
      } as unknown as FindOptionsWhere<VoteEntity>);
      await this.updateCommentVoteCounts(manager, commentId);
    });
  }

  protected async updateCommentVoteCounts(
    manager: EntityManager,
    commentId: number,
  ): Promise<void> {
    const VoteEntityClass = this.getVoteEntityName();

    const upvotes = await manager.getRepository(VoteEntityClass).count({
      where: {
        commentId,
        voteType: VoteType.UPVOTE,
      } as unknown as FindOptionsWhere<VoteEntity>,
    });
    const downvotes = await manager.getRepository(VoteEntityClass).count({
      where: {
        commentId,
        voteType: VoteType.DOWNVOTE,
      } as unknown as FindOptionsWhere<VoteEntity>,
    });

    await manager.getRepository(this.getCommentEntityName()).update(commentId, {
      upvoteCount: upvotes,
      downvoteCount: downvotes,
    } as unknown as QueryDeepPartialEntity<CommentEntity>);
  }

  protected mapToResponseDto(comment: BaseComment): BaseCommentResponseDto {
    const author: AuthorDto = {
      id: comment.author.id,
      username: comment.author.username,
      avatarUrl:
        getAvatarUrl(comment.author.avatarKey, this.storageService) ??
        undefined,
      isPremium: comment.author.isPremium,
    };

    return {
      id: comment.id,
      parentId: comment.parentId,
      content: comment.content,
      upvoteCount: comment.upvoteCount,
      downvoteCount: comment.downvoteCount,
      replyCount: comment.replyCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author,
      myVote: comment.myVote,
      replyCounts: comment.replyCount,
    };
  }
}

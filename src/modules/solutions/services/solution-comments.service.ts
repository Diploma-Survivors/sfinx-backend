import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { BaseCommentsService } from '../../comments-base/base-comments.service';
import { Solution } from '../entities/solution.entity';
import { AuthorDto } from '../../users/dto/author.dto';
import { SolutionCommentResponseDto } from '../dto';
import { SolutionComment } from '../entities/solution-comment.entity';
import { SolutionCommentVote } from '../entities/solution-comment-vote.entity';
import { StorageService } from '../../storage/storage.service';
import { VoteType } from '../../comments-base/enums';
import { BaseCreateCommentDto } from '../../comments-base/dto';
import { getAvatarUrl } from '../../../common';
import { VoteResponseDto } from '../../comments-base/dto';

@Injectable()
export class SolutionCommentsService extends BaseCommentsService<
  SolutionComment,
  SolutionCommentVote
> {
  constructor(
    @InjectRepository(SolutionComment)
    commentRepo: Repository<SolutionComment>,
    @InjectRepository(SolutionCommentVote)
    voteRepo: Repository<SolutionCommentVote>,
    storageService: StorageService,
    dataSource: DataSource,
  ) {
    super(commentRepo, voteRepo, storageService, dataSource);
  }

  protected getCommentEntityName(): string {
    return SolutionComment.name;
  }

  protected getVoteEntityName(): string {
    return SolutionCommentVote.name;
  }

  protected createVoteEntity(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): SolutionCommentVote {
    const vote = new SolutionCommentVote();
    vote.commentId = commentId;
    vote.userId = userId;
    vote.voteType = voteType;
    return vote;
  }

  protected getParentRelationIdField(): string {
    return 'solutionId';
  }

  @Transactional()
  async voteSolutionComment(
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

  @Transactional()
  async createComment(
    userId: number,
    solutionId: number,
    dto: BaseCreateCommentDto,
  ): Promise<SolutionCommentResponseDto> {
    const result = await super.createComment(userId, solutionId, dto);

    await this.dataSource
      .getRepository(Solution)
      .increment({ id: solutionId }, 'commentCount', 1);

    return result as SolutionCommentResponseDto;
  }

  @Transactional()
  async deleteComment(
    id: number,
    userId: number,
    isAdmin = false,
  ): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (comment) {
      await super.deleteComment(id, userId, isAdmin);
      await this.dataSource
        .getRepository(Solution)
        .decrement({ id: comment.solutionId }, 'commentCount', 1);
    }
  }

  @Transactional()
  async pinComment(id: number): Promise<SolutionCommentResponseDto> {
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
  async unpinComment(id: number): Promise<SolutionCommentResponseDto> {
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
    comment: SolutionComment,
    userVotes?: Map<number, number> | null,
  ): SolutionCommentResponseDto {
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
      solutionId: comment.solutionId,
      parentId: comment.parentId,
      content: comment.content,
      upvoteCount: comment.upvoteCount,
      downvoteCount: comment.downvoteCount,
      replyCount: comment.replyCount,
      isPinned: comment.isPinned,
      isEdited: comment.isEdited,
      isDeleted: comment.isDeleted,
      voteScore: comment.voteScore,
      editedAt: comment.editedAt,
      replyCounts: comment.replyCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author,
      myVote: comment.myVote,
      userVote: userVotes ? (userVotes.get(comment.id) ?? null) : null,
    };
  }
}

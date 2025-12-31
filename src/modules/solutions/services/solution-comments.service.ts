import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BaseCommentsService } from '../../comments-base/base-comments.service';
import { Solution } from '../entities/solution.entity';
import { AuthorDto } from '../../users/dtos/author.dto';
import { SolutionCommentResponseDto } from '../dto/solution-comment-response.dto';
import { SolutionComment } from '../entities/solution-comment.entity';
import { SolutionCommentVote } from '../entities/solution-comment-vote.entity';
import { StorageService } from '../../storage/storage.service';
import { VoteType } from '../../comments-base/enums/vote-type.enum';
import { BaseCreateCommentDto } from '../../comments-base/dto/base-create-comment.dto';
import { getAvatarUrl } from '../../../common/utils';

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
    // We must manually satisfy properties if they are redundant or specific
    const vote = new SolutionCommentVote();
    vote.commentId = commentId;
    vote.userId = userId;
    vote.voteType = voteType;
    return vote;
    // OR return this.voteRepo.create({ commentId, userId, voteType });
    // but TS might complain about abstract BaseCommentVote mismatches if not careful.
    // Using create() is safer if properties match.
  }

  protected getParentRelationIdField(): string {
    return 'solutionId';
  }

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

  async deleteComment(id: number, userId: number): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (comment) {
      await super.deleteComment(id, userId);
      await this.dataSource
        .getRepository(Solution)
        .decrement({ id: comment.solutionId }, 'commentCount', 1);
    }
  }

  protected mapToResponseDto(
    comment: SolutionComment,
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
      replyCounts: comment.replyCount, // Duplicate property in DTO
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author,
      myVote: comment.myVote,
    };
  }
}

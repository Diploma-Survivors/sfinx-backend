import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { VoteResponseDto } from '../dto';
import { Comment, CommentVote } from '../entities';
import { VoteType } from '../enums';

@Injectable()
export class CommentVotesService {
  constructor(
    @InjectRepository(CommentVote)
    private readonly voteRepository: Repository<CommentVote>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  /**
   * Vote on a comment (upvote or downvote)
   * Handles vote creation, update, and cached count synchronization
   */
  @Transactional()
  async voteComment(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): Promise<VoteResponseDto> {
    // Verify comment exists
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    // Check if user has already voted
    const existingVote = await this.voteRepository.findOne({
      where: { commentId, userId },
    });

    let upvoteDelta = 0;
    let downvoteDelta = 0;

    if (existingVote) {
      // User is changing their vote
      if (existingVote.voteType === voteType) {
        // Same vote type - no change needed
        return {
          voteType,
          upvoteCount: comment.upvoteCount,
          downvoteCount: comment.downvoteCount,
          voteScore: comment.voteScore,
        };
      }

      // Remove old vote counts
      if (existingVote.voteType === VoteType.UPVOTE) {
        upvoteDelta -= 1;
      } else {
        downvoteDelta -= 1;
      }

      // Add new vote counts
      if (voteType === VoteType.UPVOTE) {
        upvoteDelta += 1;
      } else {
        downvoteDelta += 1;
      }

      // Update existing vote
      existingVote.voteType = voteType;
      existingVote.updatedAt = new Date();
      await this.voteRepository.save(existingVote);
    } else {
      // New vote
      if (voteType === VoteType.UPVOTE) {
        upvoteDelta = 1;
      } else {
        downvoteDelta = 1;
      }

      // Create new vote
      await this.voteRepository.save({
        commentId,
        userId,
        voteType,
      });
    }

    // Update cached counts atomically
    await this.commentRepository
      .createQueryBuilder()
      .update(Comment)
      .set({
        upvoteCount: () => `upvote_count + ${upvoteDelta}`,
        downvoteCount: () => `downvote_count + ${downvoteDelta}`,
        voteScore: () => `vote_score + ${upvoteDelta - downvoteDelta}`,
      })
      .where('id = :id', { id: commentId })
      .execute();

    // Fetch updated counts
    const updatedComment = await this.commentRepository.findOne({
      where: { id: commentId },
      select: ['upvoteCount', 'downvoteCount', 'voteScore'],
    });

    return {
      voteType,
      upvoteCount: updatedComment!.upvoteCount,
      downvoteCount: updatedComment!.downvoteCount,
      voteScore: updatedComment!.voteScore,
    };
  }

  /**
   * Remove user's vote from a comment
   */
  @Transactional()
  async removeVote(commentId: number, userId: number): Promise<void> {
    const vote = await this.voteRepository.findOne({
      where: { commentId, userId },
    });

    if (!vote) {
      // No vote to remove
      return;
    }

    // Calculate deltas
    const upvoteDelta = vote.voteType === VoteType.UPVOTE ? -1 : 0;
    const downvoteDelta = vote.voteType === VoteType.DOWNVOTE ? -1 : 0;

    // Delete vote
    await this.voteRepository.delete({ commentId, userId });

    // Update cached counts atomically
    await this.commentRepository
      .createQueryBuilder()
      .update(Comment)
      .set({
        upvoteCount: () => `upvote_count + ${upvoteDelta}`,
        downvoteCount: () => `downvote_count + ${downvoteDelta}`,
        voteScore: () => `vote_score + ${upvoteDelta - downvoteDelta}`,
      })
      .where('id = :id', { id: commentId })
      .execute();
  }

  /**
   * Get user's votes for multiple comments (batch fetch)
   */
  async getUserVotes(
    commentIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    if (commentIds.length === 0) {
      return new Map();
    }

    const votes = await this.voteRepository.find({
      where: {
        commentId: In(commentIds),
        userId,
      },
      select: ['commentId', 'voteType'],
    });

    const voteMap = new Map<number, number>();
    votes.forEach((vote) => {
      voteMap.set(vote.commentId, vote.voteType);
    });

    return voteMap;
  }

  /**
   * Get user's vote for a single comment
   */
  async getUserVote(commentId: number, userId: number): Promise<number | null> {
    const vote = await this.voteRepository.findOne({
      where: { commentId, userId },
      select: ['voteType'],
    });

    return vote?.voteType ?? null;
  }
}

import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { BaseVote } from './entities/base-vote.entity';
import { VoteType } from './enums';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Abstract base service for voting functionality
 * Can be used for solution votes, problem votes, etc.
 */
export abstract class BaseVotesService<
  VotableEntity extends ObjectLiteral,
  VoteEntity extends BaseVote,
> {
  constructor(
    protected readonly votableRepo: Repository<VotableEntity>,
    protected readonly voteRepo: Repository<VoteEntity>,
    protected readonly dataSource: DataSource,
  ) {}

  protected abstract getVotableEntityName(): string;
  protected abstract getVoteEntityName(): string;
  protected abstract getVotableIdField(): string; // e.g., 'solutionId', 'problemId'
  protected abstract createVoteEntity(
    votableId: number,
    userId: number,
    voteType: VoteType,
  ): VoteEntity;

  /**
   * Vote on an entity (toggle if same vote, change if different)
   */
  async vote(
    votableId: number,
    userId: number,
    voteType: VoteType,
  ): Promise<void> {
    const votableIdField = this.getVotableIdField();

    const existingVote = await this.voteRepo
      .createQueryBuilder('vote')
      .where(`vote.${votableIdField} = :votableId`, { votableId })
      .andWhere('vote.userId = :userId', { userId })
      .getOne();

    await this.dataSource.transaction(async (manager) => {
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Remove vote (toggle off)
          await manager.getRepository(this.getVoteEntityName()).delete({
            [votableIdField]: votableId,
            userId,
          } as unknown as FindOptionsWhere<VoteEntity>);
          await this.updateVoteCounts(manager, votableId);
        } else {
          // Change vote
          existingVote.voteType = voteType;
          await manager.save(existingVote);
          await this.updateVoteCounts(manager, votableId);
        }
      } else {
        // New vote
        const newVote = this.createVoteEntity(votableId, userId, voteType);
        await manager.save(newVote);
        await this.updateVoteCounts(manager, votableId);
      }
    });
  }

  /**
   * Remove vote from an entity
   */
  async unvote(votableId: number, userId: number): Promise<void> {
    const votableIdField = this.getVotableIdField();

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(this.getVoteEntityName()).delete({
        [votableIdField]: votableId,
        userId,
      } as unknown as FindOptionsWhere<VoteEntity>);
      await this.updateVoteCounts(manager, votableId);
    });
  }

  /**
   * Get user's vote on an entity
   */
  async getUserVote(votableId: number, userId: number): Promise<number | null> {
    const votableIdField = this.getVotableIdField();

    const vote = await this.voteRepo
      .createQueryBuilder('vote')
      .where(`vote.${votableIdField} = :votableId`, { votableId })
      .andWhere('vote.userId = :userId', { userId })
      .getOne();

    if (!vote) return null;
    return vote.voteType as number;
  }

  /**
   * Get user's votes for multiple entities (batch operation)
   */
  async getUserVotes(
    votableIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    if (votableIds.length === 0) return new Map();

    const votableIdField = this.getVotableIdField();

    const votes = await this.voteRepo
      .createQueryBuilder('vote')
      .where(`vote.${votableIdField} IN (:...votableIds)`, { votableIds })
      .andWhere('vote.userId = :userId', { userId })
      .getMany();

    const map = new Map<number, number>();
    votes.forEach((vote) => {
      const id = (vote as unknown as Record<string, number>)[votableIdField];
      map.set(id, vote.voteType as number);
    });
    return map;
  }

  /**
   * Update vote counts for an entity
   */
  protected async updateVoteCounts(
    manager: EntityManager,
    votableId: number,
  ): Promise<void> {
    const votableIdField = this.getVotableIdField();
    const VoteEntityClass = this.getVoteEntityName();

    const upvotes = await manager.getRepository(VoteEntityClass).count({
      where: {
        [votableIdField]: votableId,
        voteType: VoteType.UPVOTE,
      } as unknown as FindOptionsWhere<VoteEntity>,
    });

    const downvotes = await manager.getRepository(VoteEntityClass).count({
      where: {
        [votableIdField]: votableId,
        voteType: VoteType.DOWNVOTE,
      } as unknown as FindOptionsWhere<VoteEntity>,
    });

    await manager.getRepository(this.getVotableEntityName()).update(votableId, {
      upvoteCount: upvotes,
      downvoteCount: downvotes,
      voteScore: upvotes - downvotes,
    } as unknown as QueryDeepPartialEntity<VotableEntity>);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseVotesService } from '../../comments-base/base-votes.service';
import { Solution } from '../entities/solution.entity';
import { SolutionVote } from '../entities/solution-vote.entity';
import { VoteType } from '../../comments-base/enums';

/**
 * Service for handling solution votes
 * Extends base voting functionality
 */
@Injectable()
export class SolutionVotesService extends BaseVotesService<
  Solution,
  SolutionVote
> {
  constructor(
    @InjectRepository(Solution)
    solutionRepo: Repository<Solution>,
    @InjectRepository(SolutionVote)
    solutionVoteRepo: Repository<SolutionVote>,
    dataSource: DataSource,
  ) {
    super(solutionRepo, solutionVoteRepo, dataSource);
  }

  protected getVotableEntityName(): string {
    return Solution.name;
  }

  protected getVoteEntityName(): string {
    return SolutionVote.name;
  }

  protected getVotableIdField(): string {
    return 'solutionId';
  }

  protected createVoteEntity(
    solutionId: number,
    userId: number,
    voteType: VoteType,
  ): SolutionVote {
    const vote = new SolutionVote();
    vote.solutionId = solutionId;
    vote.userId = userId;
    vote.voteType = voteType;
    return vote;
  }
}

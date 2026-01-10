import { VoteType } from '../enums';

export abstract class BaseVote {
  abstract userId: number;
  abstract voteType: VoteType;
}

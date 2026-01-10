import { VoteType } from '../enums';

export abstract class BaseCommentVote {
  abstract userId: number;
  abstract commentId: number;
  abstract voteType: VoteType;
}

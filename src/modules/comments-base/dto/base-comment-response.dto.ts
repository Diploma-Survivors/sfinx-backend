import { CommentAuthorDto } from './comment-author.dto';

export class BaseCommentResponseDto {
  id: number;
  parentId: number | null;
  content: string;
  upvoteCount: number;
  downvoteCount: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthorDto;
  myVote?: 'up_vote' | 'down_vote' | null;
  replyCounts?: number;
  replies?: BaseCommentResponseDto[];
}

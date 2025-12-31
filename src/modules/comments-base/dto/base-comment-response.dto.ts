import { AuthorDto } from '../../users/dtos/author.dto';

export class BaseCommentResponseDto {
  id: number;
  parentId: number | null;
  content: string;
  upvoteCount: number;
  downvoteCount: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorDto;
  myVote?: 'up_vote' | 'down_vote' | null;
  replyCounts?: number;
  replies?: BaseCommentResponseDto[];
}

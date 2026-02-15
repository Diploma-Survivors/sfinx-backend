import { AuthorDto } from '../../users/dto/author.dto';

export class BaseCommentResponseDto {
  id: number;
  parentId: number | null;
  content: string;
  upvoteCount: number;
  downvoteCount: number;
  replyCount: number;
  isPinned: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  voteScore: number;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorDto;
  replyCounts?: number;
  userVote?: number | null;
  myVote?: 'up_vote' | 'down_vote' | null;
  replies?: BaseCommentResponseDto[];
}

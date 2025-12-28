import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentType } from '../enums';
import { CommentAuthorDto } from './comment-author.dto';

export class CommentResponseDto {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  id: number;

  @ApiProperty({ description: 'Problem ID', example: 1 })
  problemId: number;

  @ApiPropertyOptional({
    description: 'Parent comment ID for nested replies',
    example: 42,
    nullable: true,
  })
  parentId: number | null;

  @ApiProperty({
    description: 'Comment content in markdown format',
    example: '**Great problem!** I used two pointers approach.',
  })
  content: string;

  @ApiProperty({
    description: 'Comment type for categorization',
    enum: CommentType,
    example: CommentType.FEEDBACK,
  })
  type: CommentType;

  @ApiProperty({
    description: 'Whether this comment is pinned by moderators',
    example: false,
  })
  isPinned: boolean;

  @ApiProperty({
    description: 'Whether this comment has been edited',
    example: false,
  })
  isEdited: boolean;

  @ApiProperty({
    description: 'Soft delete flag',
    example: false,
  })
  isDeleted: boolean;

  @ApiProperty({ description: 'Total upvotes count', example: 42 })
  upvoteCount: number;

  @ApiProperty({ description: 'Total downvotes count', example: 3 })
  downvoteCount: number;

  @ApiProperty({
    description: 'Net vote score (upvotes - downvotes)',
    example: 39,
  })
  voteScore: number;

  @ApiProperty({ description: 'Total number of replies', example: 5 })
  replyCount: number;

  @ApiProperty({ description: 'Number of reports on this comment', example: 0 })
  reportCount: number;

  @ApiPropertyOptional({
    description: 'Last edit timestamp',
    example: '2025-01-15T10:30:00Z',
    nullable: true,
  })
  editedAt: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T09:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Comment author',
    type: () => CommentAuthorDto,
  })
  author: CommentAuthorDto;

  @ApiPropertyOptional({
    description:
      'Current user vote on this comment (1 for upvote, -1 for downvote, null if not voted)',
    example: 1,
    nullable: true,
  })
  userVote?: number | null;

  @ApiPropertyOptional({
    description: 'Nested replies to this comment',
    type: () => [CommentResponseDto],
    isArray: true,
  })
  replies?: CommentResponseDto[];
}

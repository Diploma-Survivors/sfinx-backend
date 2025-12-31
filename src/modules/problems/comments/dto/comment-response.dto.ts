import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentType } from '../enums';
import { BaseCommentResponseDto } from '../../../comments-base/dto';
import { AuthorDto } from '../../../users/dtos/author.dto';

export class CommentResponseDto extends BaseCommentResponseDto {
  @ApiProperty({ description: 'Problem ID', example: 1 })
  problemId: number;

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

  @ApiProperty({
    description: 'Net vote score (upvotes - downvotes)',
    example: 39,
  })
  voteScore: number;

  @ApiProperty({ description: 'Number of reports on this comment', example: 0 })
  reportCount: number;

  @ApiPropertyOptional({
    description: 'Last edit timestamp',
    example: '2025-01-15T10:30:00Z',
    nullable: true,
  })
  editedAt: Date | null;

  @ApiProperty({
    description: 'Comment author',
    type: () => AuthorDto,
  })
  declare author: AuthorDto;

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
  declare replies?: CommentResponseDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseCommentResponseDto } from '../../../comments-base/dto';
import { AuthorDto } from '../../../users/dto/author.dto';
import { CommentType } from '../enums';

export class ProblemCommentResponseDto extends BaseCommentResponseDto {
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
  declare isPinned: boolean;

  @ApiProperty({
    description: 'Whether this comment has been edited',
    example: false,
  })
  declare isEdited: boolean;

  @ApiProperty({
    description: 'Soft delete flag',
    example: false,
  })
  declare isDeleted: boolean;

  @ApiProperty({
    description: 'Net vote score (upvotes - downvotes)',
    example: 39,
  })
  declare voteScore: number;

  @ApiProperty({ description: 'Number of reports on this comment', example: 0 })
  reportCount: number;

  @ApiPropertyOptional({
    description: 'Last edit timestamp',
    example: '2025-01-15T10:30:00Z',
    nullable: true,
  })
  declare editedAt: Date | null;

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
  declare userVote?: number | null;

  @ApiPropertyOptional({
    description: 'Nested replies to this comment',
    type: () => [ProblemCommentResponseDto],
    isArray: true,
  })
  declare replies?: ProblemCommentResponseDto[];
}

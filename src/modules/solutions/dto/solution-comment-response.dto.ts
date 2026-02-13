import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseCommentResponseDto } from '../../comments-base/dto';
import { AuthorDto } from '../../users/dto/author.dto';

export class SolutionCommentResponseDto extends BaseCommentResponseDto {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  declare id: number;

  @ApiProperty({ description: 'Solution ID', example: 1 })
  solutionId: number;

  @ApiPropertyOptional({
    description: 'Parent comment ID for nested replies',
    example: 42,
    nullable: true,
  })
  declare parentId: number | null;

  @ApiProperty({
    description: 'Comment content in markdown format',
    example: '**Great solution!** I used two pointers approach.',
  })
  declare content: string;

  @ApiProperty({ description: 'Total upvotes count', example: 42 })
  declare upvoteCount: number;

  @ApiProperty({ description: 'Total downvotes count', example: 3 })
  declare downvoteCount: number;

  @ApiProperty({ description: 'Total number of replies', example: 5 })
  declare replyCount: number;

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

  @ApiPropertyOptional({
    description: 'Last edit timestamp',
    example: '2025-01-15T10:30:00Z',
    nullable: true,
  })
  declare editedAt: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T09:00:00Z',
  })
  declare createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  declare updatedAt: Date;

  @ApiProperty({
    description: 'Comment author',
    type: () => AuthorDto,
  })
  declare author: AuthorDto;

  @ApiPropertyOptional({
    description:
      'Current user vote on this comment (up_vote, down_vote, or null)',
    example: 'up_vote',
    nullable: true,
  })
  declare myVote?: 'up_vote' | 'down_vote' | null;

  @ApiPropertyOptional({
    description:
      'Current user vote on this comment (1 for upvote, -1 for downvote, null if not voted)',
    example: 1,
    nullable: true,
  })
  declare userVote?: number | null;

  @ApiProperty({
    description: 'Total number of replies (frontend alias)',
    example: 0,
  })
  declare replyCounts: number;

  @ApiPropertyOptional({
    description: 'Nested replies to this comment',
    type: () => [SolutionCommentResponseDto],
    isArray: true,
  })
  declare replies?: SolutionCommentResponseDto[];
}

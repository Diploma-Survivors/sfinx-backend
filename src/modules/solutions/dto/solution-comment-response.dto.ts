import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorDto } from '../../users/dtos/author.dto';

export class SolutionCommentResponseDto {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  id: number;

  @ApiProperty({ description: 'Solution ID', example: 1 })
  solutionId: number;

  @ApiPropertyOptional({
    description: 'Parent comment ID for nested replies',
    example: 42,
    nullable: true,
  })
  parentId: number | null;

  @ApiProperty({
    description: 'Comment content in markdown format',
    example: '**Great solution!** I used two pointers approach.',
  })
  content: string;

  @ApiProperty({ description: 'Total upvotes count', example: 42 })
  upvoteCount: number;

  @ApiProperty({ description: 'Total downvotes count', example: 3 })
  downvoteCount: number;

  @ApiProperty({ description: 'Total number of replies', example: 5 })
  replyCount: number;

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
    type: () => AuthorDto,
  })
  author: AuthorDto;

  @ApiPropertyOptional({
    description:
      'Current user vote on this comment (up_vote, down_vote, or null)',
    example: 'up_vote',
    nullable: true,
  })
  myVote?: 'up_vote' | 'down_vote' | null;

  @ApiProperty({
    description: 'Total number of replies (frontend alias)',
    example: 0,
  })
  replyCounts: number;
}

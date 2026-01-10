import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for comment vote operations
 */
export class VoteResponseDto {
  @ApiProperty({
    description:
      'The vote type applied by the user (1 = upvote, -1 = downvote)',
    example: 1,
    enum: [1, -1],
  })
  voteType: number;

  @ApiProperty({
    description: 'Total number of upvotes on the comment',
    example: 42,
  })
  upvoteCount: number;

  @ApiProperty({
    description: 'Total number of downvotes on the comment',
    example: 3,
  })
  downvoteCount: number;

  @ApiProperty({
    description: 'Net vote score (upvotes - downvotes)',
    example: 39,
    required: false,
  })
  voteScore?: number;
}

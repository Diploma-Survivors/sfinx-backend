import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemScoreDto {
  @ApiProperty({ description: 'Problem ID' })
  problemId: number;

  @ApiProperty({ description: 'Score for this problem (IOI partial scoring)' })
  score: number;

  @ApiProperty({ description: 'Number of submissions for this problem' })
  submissions: number;

  @ApiPropertyOptional({ description: 'Last submission time' })
  lastSubmitTime: string | null;
}

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'Rank in leaderboard' })
  rank: number;

  @ApiProperty({ description: 'User ID' })
  userId: number;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiPropertyOptional({ description: 'User avatar URL' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Total score (sum of best scores per problem)' })
  totalScore: number;

  @ApiProperty({
    description: 'Score breakdown per problem',
    type: [ProblemScoreDto],
  })
  problemScores: ProblemScoreDto[];

  @ApiProperty({ description: 'Total number of submissions' })
  totalSubmissions: number;

  @ApiPropertyOptional({ description: 'Last submission time (for tiebreaker)' })
  lastSubmissionAt: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LeaderboardProblemStatus {
  SOLVED = 'SOLVED',
  ATTEMPTED = 'ATTEMPTED',
  NOT_STARTED = 'NOT_STARTED',
}

export class ProblemStatusDto {
  @ApiProperty({ description: 'Problem ID' })
  problemId: number;

  @ApiProperty({ description: 'Order of the problem in the contest' })
  problemOrder: number;

  @ApiProperty({
    enum: LeaderboardProblemStatus,
    description: 'Status of the problem for the user',
  })
  status: LeaderboardProblemStatus;

  @ApiPropertyOptional({ description: 'Score achieved for this problem' })
  score?: number;

  @ApiPropertyOptional({ description: 'Number of attempts/submissions' })
  attempts?: number;
}

export class LeaderboardUserDto {
  @ApiProperty({ description: 'User ID' })
  id: number;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiPropertyOptional({ description: 'User avatar URL' })
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Full name' })
  fullName?: string;
}

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'Rank in leaderboard' })
  rank: number;

  @ApiProperty({ description: 'User details' })
  user: LeaderboardUserDto;

  @ApiProperty({ description: 'Total score' })
  totalScore: number;

  @ApiProperty({
    description: 'Status and score for each problem',
    type: [ProblemStatusDto],
  })
  problemStatus: ProblemStatusDto[];
}

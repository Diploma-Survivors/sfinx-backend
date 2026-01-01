import { ApiProperty } from '@nestjs/swagger';

export class ProblemDifficultyStatsDto {
  @ApiProperty()
  solved: number;

  @ApiProperty()
  total: number;
}

export class ProblemStatsDto {
  @ApiProperty({ type: ProblemDifficultyStatsDto })
  easy: ProblemDifficultyStatsDto;

  @ApiProperty({ type: ProblemDifficultyStatsDto })
  medium: ProblemDifficultyStatsDto;

  @ApiProperty({ type: ProblemDifficultyStatsDto })
  hard: ProblemDifficultyStatsDto;

  @ApiProperty({ type: ProblemDifficultyStatsDto })
  total: ProblemDifficultyStatsDto;
}

export class SubmissionStatsDto {
  @ApiProperty()
  accepted: number;

  @ApiProperty()
  wrongAnswer: number;

  @ApiProperty()
  timeLimitExceeded: number;

  @ApiProperty()
  runtimeError: number;

  @ApiProperty()
  compilationError: number;

  @ApiProperty()
  others: number;

  @ApiProperty()
  total: number;
}

export class UserStatisticsDto {
  @ApiProperty({ type: ProblemStatsDto })
  problemStats: ProblemStatsDto;

  @ApiProperty({ type: SubmissionStatsDto })
  submissionStats: SubmissionStatsDto;
}

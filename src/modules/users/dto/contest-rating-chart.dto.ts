import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContestRatingDataPointDto {
  @ApiProperty({ description: 'Contest ID' })
  contestId: number;

  @ApiProperty({ description: 'Contest title' })
  contestTitle: string;

  @ApiProperty({ description: 'Contest end time (x-axis)' })
  contestEndTime: Date;

  @ApiProperty({ description: 'Rating after this contest (y-axis)' })
  rating: number;

  @ApiProperty({
    description: 'Rating change (positive = gain, negative = loss)',
  })
  ratingDelta: number;

  @ApiProperty({ description: 'Final rank achieved in this contest' })
  contestRank: number;
}

export class ContestRatingChartDto {
  @ApiProperty({
    description:
      'Rating history data points ordered chronologically for chart rendering',
    type: () => [ContestRatingDataPointDto],
  })
  history: ContestRatingDataPointDto[];

  @ApiProperty({ description: 'Current contest ELO rating' })
  currentRating: number;

  @ApiPropertyOptional({
    description:
      'Global contest ranking position (1-based). Null if not yet ranked.',
    nullable: true,
  })
  globalRank: number | null;

  @ApiPropertyOptional({
    description:
      'Total number of ranked users in the global contest leaderboard',
  })
  totalRanked: number;

  @ApiProperty({ description: 'Total rated contests attended' })
  contestsAttended: number;

  @ApiPropertyOptional({
    description:
      'Top percentage among all ranked users (e.g. 5.2 means top 5.2%). Null if not yet ranked.',
    nullable: true,
  })
  topPercentage: number | null;

  @ApiPropertyOptional({
    description: 'Highest rating ever achieved',
    nullable: true,
  })
  peakRating: number | null;

  @ApiPropertyOptional({
    description: 'Lowest rating recorded',
    nullable: true,
  })
  lowestRating: number | null;
}

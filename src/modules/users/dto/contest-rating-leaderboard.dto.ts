import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContestRatingUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  fullName: string | null;

  @ApiPropertyOptional()
  avatarUrl: string | null;
}

export class ContestRatingLeaderboardEntryDto {
  @ApiProperty({ description: '1-based rank position' })
  rank: number;

  @ApiProperty({ type: ContestRatingUserDto })
  user: ContestRatingUserDto;

  @ApiProperty({ description: 'Contest ELO rating' })
  contestRating: number;

  @ApiProperty({ description: 'Number of rated contests participated' })
  contestsParticipated: number;
}

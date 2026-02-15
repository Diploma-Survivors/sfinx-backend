import { ApiProperty } from '@nestjs/swagger';

export class ContestHistoryEntryDto {
  @ApiProperty()
  contestId: number;

  @ApiProperty()
  contestTitle: string;

  @ApiProperty()
  contestEndTime: Date;

  @ApiProperty({ description: 'Final rank in this contest' })
  contestRank: number;

  @ApiProperty({ description: 'ELO rating before this contest' })
  ratingBefore: number;

  @ApiProperty({ description: 'ELO rating after this contest' })
  ratingAfter: number;

  @ApiProperty({
    description: 'Rating change (positive = gain, negative = loss)',
  })
  ratingDelta: number;
}

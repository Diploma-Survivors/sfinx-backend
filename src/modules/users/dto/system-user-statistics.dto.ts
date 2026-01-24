import { ApiProperty } from '@nestjs/swagger';

export class SystemUserStatisticsDto {
  @ApiProperty({ description: 'Total number of users' })
  total: number;

  @ApiProperty({ description: 'Number of active users' })
  active: number;

  @ApiProperty({ description: 'Number of premium users' })
  premium: number;

  @ApiProperty({ description: 'Number of banned users' })
  banned: number;
}

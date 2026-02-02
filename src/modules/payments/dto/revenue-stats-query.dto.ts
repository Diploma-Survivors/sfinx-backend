import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RevenueStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO format)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO format)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
  @ApiPropertyOptional({
    description: 'Group by period (day, week, month, year)',
    enum: ['day', 'week', 'month', 'year'],
    default: 'month',
  })
  @IsOptional()
  @IsString()
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

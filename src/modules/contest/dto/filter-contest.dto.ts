import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { ContestSortBy } from '../enums/contest-sort-by.enum';
import { ContestStatus } from '../enums/contest-status.enum';

export class FilterContestDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by contest status',
    enum: ContestStatus,
  })
  @IsEnum(ContestStatus)
  @IsOptional()
  status?: ContestStatus;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ContestSortBy,
    default: ContestSortBy.START_TIME,
  })
  @IsEnum(ContestSortBy)
  @IsOptional()
  override sortBy?: string = ContestSortBy.START_TIME;

  @ApiPropertyOptional({
    description: 'Filter contests starting after this date',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter contests starting before this date',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startBefore?: Date;

  @ApiPropertyOptional({ description: 'Search by title' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Include only upcoming contests' })
  @IsOptional()
  @Type(() => Boolean)
  upcomingOnly?: boolean;

  @ApiPropertyOptional({ description: 'Include only running contests' })
  @IsOptional()
  @Type(() => Boolean)
  runningOnly?: boolean;
}

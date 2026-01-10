import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { ContestSortBy } from '../enums';
import { ContestStatus, UserContestStatus } from '../enums';
import { ToBoolean } from '../../../common/decorators/transform.decorators';

export class FilterContestDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by contest status',
    enum: ContestStatus,
  })
  @IsEnum(ContestStatus)
  @IsOptional()
  status?: ContestStatus;

  @ApiPropertyOptional({
    description: 'Filter by user participation status (JOINED, NOT_JOINED)',
    enum: [UserContestStatus.JOINED, UserContestStatus.NOT_JOINED],
  })
  @IsEnum(UserContestStatus)
  @IsOptional()
  userStatus?: UserContestStatus;

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
  @ToBoolean()
  upcomingOnly?: boolean;

  @ApiPropertyOptional({ description: 'Include only running contests' })
  @IsOptional()
  @ToBoolean()
  runningOnly?: boolean;
}

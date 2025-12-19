import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { SortBy } from '../enums/sort-by.enum';
import { SubmissionStatus } from '../enums/submission-status.enum';

export class FilterSubmissionDto extends OmitType(PaginationQueryDto, [
  'sortBy',
]) {
  @ApiPropertyOptional({
    description: 'Sort by',
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy: SortBy = SortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Filter by problem ID',
    type: Number,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  problemId?: number;

  @ApiPropertyOptional({
    description: 'Filter by programming language ID',
    type: Number,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  languageId?: number;

  @ApiPropertyOptional({
    description: 'Filter by submission status',
    enum: SubmissionStatus,
  })
  @IsEnum(SubmissionStatus)
  @IsOptional()
  status?: SubmissionStatus;
}

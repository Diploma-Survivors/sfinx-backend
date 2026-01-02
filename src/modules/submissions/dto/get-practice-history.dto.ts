import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common';
import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';
import { ProgressStatus } from '../enums';
import { PracticeSortBy } from '../enums/practice-sort-by.enum';

export class GetPracticeHistoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: PracticeSortBy,
    default: PracticeSortBy.LAST_SUBMITTED_AT,
  })
  @IsEnum(PracticeSortBy)
  @IsOptional()
  readonly sortBy?: PracticeSortBy = PracticeSortBy.LAST_SUBMITTED_AT;
  @ApiPropertyOptional({
    description: 'Filter by problem difficulty',
    enum: ProblemDifficulty,
  })
  @IsEnum(ProblemDifficulty)
  @IsOptional()
  difficulty?: ProblemDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by progress status',
    enum: ProgressStatus,
  })
  @IsEnum(ProgressStatus)
  @IsOptional()
  status?: ProgressStatus;
}

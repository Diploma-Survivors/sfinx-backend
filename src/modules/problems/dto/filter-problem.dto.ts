import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { ProgressStatus } from '../../submissions/enums/progress-status.enum';
import { ProblemDifficulty } from '../enums/problem-difficulty.enum';
import { SortBy } from '../enums/sort-by.enum';

export class FilterProblemDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by user progress status. Requires authentication. Options: "solved", "attempted", "not-started".',
    enum: ProgressStatus,
  })
  @IsOptional()
  @IsEnum(ProgressStatus)
  status?: ProgressStatus;

  @ApiPropertyOptional({
    description:
      'Field to sort by. Defaults to "id". Options: "id", "difficulty", "acceptanceRate", "createdAt", "updatedAt". Note: If "search" is provided, results are automatically sorted by relevance first.',
    enum: SortBy,
    default: SortBy.ID,
  })
  @IsOptional()
  @IsEnum(SortBy)
  override sortBy?: SortBy = SortBy.ID;

  @ApiPropertyOptional({
    description:
      'Filter by problem difficulty. Options: "Easy", "Medium", "Hard".',
    enum: ProblemDifficulty,
  })
  @IsOptional()
  @IsEnum(ProblemDifficulty)
  difficulty?: ProblemDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by premium status. true = premium only, false = free.',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPremium?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by one or more topic IDs. Returns problems matching ANY of the provided topic IDs.',
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  topicIds?: number[];

  @ApiPropertyOptional({
    description:
      'Filter by one or more tag IDs. Returns problems matching ANY of the provided tag IDs.',
    type: [Number],
    example: [5, 8],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  tagIds?: number[];

  @ApiPropertyOptional({
    description:
      'Full-text search on title and description. When used, results are sorted by relevance score descending.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

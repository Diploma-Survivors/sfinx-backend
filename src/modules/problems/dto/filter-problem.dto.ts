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
import { ProblemDifficulty } from '../enums/problem-difficulty.enum';
import { SortBy } from '../enums/sort-by.enum';

export class FilterProblemDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Sort by',
    enum: SortBy,
    default: SortBy.ID,
  })
  @IsOptional()
  @IsEnum(SortBy)
  override sortBy?: SortBy = SortBy.ID;

  @ApiPropertyOptional({
    description: 'Filter by difficulty',
    enum: ProblemDifficulty,
  })
  @IsOptional()
  @IsEnum(ProblemDifficulty)
  difficulty?: ProblemDifficulty;

  @ApiPropertyOptional({ description: 'Filter by premium status' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPremium?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by topic IDs',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  topicIds?: number[];

  @ApiPropertyOptional({
    description: 'Filter by tag IDs',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  tagIds?: number[];

  @ApiPropertyOptional({
    description: 'Search by title or description',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

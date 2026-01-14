import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum SolutionSortBy {
  RECENT = 'recent',
  MOST_VOTED = 'most_voted',
}

export class FilterSolutionDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Problem ID' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  problemId?: number;

  @ApiPropertyOptional({ description: 'Search keyword for title' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Filter by Tag IDs' })
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v: string) => parseInt(v, 10));
    return [parseInt(value, 10)];
  })
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[];

  @ApiPropertyOptional({ description: 'Filter by Language IDs' })
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v: string) => parseInt(v, 10));
    return [parseInt(value, 10)];
  })
  @IsArray()
  @IsNumber({}, { each: true })
  languageIds?: number[];

  @ApiPropertyOptional({
    description: 'Sort option',
    enum: SolutionSortBy,
    default: SolutionSortBy.RECENT,
  })
  @IsOptional()
  @IsEnum(SolutionSortBy)
  sortBy?: SolutionSortBy = SolutionSortBy.RECENT;
}

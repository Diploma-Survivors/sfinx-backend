import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { StudyPlanDifficulty } from '../enums/study-plan-difficulty.enum';
import { StudyPlanSortBy } from '../enums/study-plan-sort-by.enum';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';

export class FilterStudyPlanDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by difficulty',
    enum: StudyPlanDifficulty,
  })
  @IsOptional()
  @IsEnum(StudyPlanDifficulty)
  difficulty?: StudyPlanDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: StudyPlanStatus,
  })
  @IsOptional()
  @IsEnum(StudyPlanStatus)
  status?: StudyPlanStatus;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by topic ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  topicId?: number;

  @ApiPropertyOptional({ description: 'Filter by tag ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tagId?: number;

  @ApiPropertyOptional({ description: 'Filter by premium status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    return value === 'true' || value === true;
  })
  isPremium?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: StudyPlanSortBy,
    default: StudyPlanSortBy.CREATED_AT,
  })
  @IsEnum(StudyPlanSortBy)
  @IsOptional()
  override sortBy?: string = StudyPlanSortBy.CREATED_AT;
}

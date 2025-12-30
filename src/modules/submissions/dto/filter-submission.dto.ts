import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { SortBy } from '../enums/sort-by.enum';
import { SubmissionStatus } from '../enums/submission-status.enum';
import { ToBoolean } from '../../../common/decorators/transform.decorators';

export class FilterSubmissionDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: SortBy,
    default: SortBy.SUBMITTED_AT,
  })
  @IsEnum(SortBy)
  @IsOptional()
  override sortBy?: SortBy = SortBy.SUBMITTED_AT;

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

  @ApiPropertyOptional({
    description: 'Filter by user ID (admin only)',
    type: Number,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  userId?: number;

  @ApiPropertyOptional({
    description: 'Filter submissions from this date',
    type: Date,
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  fromDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter submissions until this date',
    type: Date,
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  @ValidateIf(
    (o: FilterSubmissionDto) =>
      o.fromDate !== undefined || o.toDate !== undefined,
  )
  toDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by minimum runtime in milliseconds',
    type: Number,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minRuntimeMs?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum runtime in milliseconds',
    type: Number,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxRuntimeMs?: number;

  @ApiPropertyOptional({
    description: 'Filter by minimum memory usage in KB',
    type: Number,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minMemoryKb?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum memory usage in KB',
    type: Number,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxMemoryKb?: number;

  @ApiPropertyOptional({
    description: 'Only show accepted submissions',
    type: Boolean,
  })
  @IsOptional()
  @ToBoolean()
  acceptedOnly?: boolean;
}

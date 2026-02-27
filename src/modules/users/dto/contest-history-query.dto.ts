import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ContestHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by contest title (partial match)',
    example: 'weekly',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter contests ending after this date (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @ApiPropertyOptional({
    description: 'Filter contests ending before this date (ISO 8601)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @ApiPropertyOptional({
    description:
      'Filter contests where rating delta is at least this value (can be negative)',
    example: -100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minDelta?: number;

  @ApiPropertyOptional({
    description:
      'Filter contests where rating delta is at most this value (can be negative)',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxDelta?: number;

  @ApiPropertyOptional({
    description: 'Filter by minimum rank achieved in a contest',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minRank?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum rank achieved in a contest',
    minimum: 1,
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRank?: number;
}

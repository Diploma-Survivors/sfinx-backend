import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Sort order enum
 */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Base pagination query DTO
 * Use this as a base class or standalone for pagination queries
 *
 * @example
 * // Standalone usage
 * class MyController {
 *   @Get()
 *   findAll(@Query() paginationQuery: PaginationQueryDto) {
 *     return this.service.findAll(paginationQuery);
 *   }
 * }
 *
 * @example
 * // Extended usage
 * class FilterUserDto extends PaginationQueryDto {
 *   @ApiPropertyOptional()
 *   @IsOptional()
 *   @IsString()
 *   name?: string;
 * }
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  readonly limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  readonly sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  readonly sortOrder: SortOrder = SortOrder.DESC;

  /**
   * Calculate skip/offset for database queries
   */
  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }

  /**
   * Calculate take/limit for database queries
   */
  get take(): number {
    return this.limit ?? 20;
  }
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common';

export class FilterPostDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search by title',
    example: 'NestJS',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tag IDs',
    example: [1, 2],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @Transform(({ value }): number[] => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => Number(v));
    }
    return Array.isArray(value) ? value : [value];
  })
  @IsInt({ each: true })
  tagIds?: number[];
}

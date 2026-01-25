import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  @IsInt({ each: true })
  tagIds?: number[];
}

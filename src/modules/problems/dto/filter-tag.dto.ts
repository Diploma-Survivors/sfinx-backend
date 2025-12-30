import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common';

export enum TagSortBy {
  ID = 'id',
  NAME = 'name',
  CREATED_AT = 'createdAt',
}

export class FilterTagDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: TagSortBy,
    default: TagSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(TagSortBy)
  override sortBy?: string = TagSortBy.NAME;
}

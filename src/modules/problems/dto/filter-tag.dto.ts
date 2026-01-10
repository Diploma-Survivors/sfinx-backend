import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { ToBoolean } from '../../../common/decorators/transform.decorators';

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
  @ToBoolean()
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

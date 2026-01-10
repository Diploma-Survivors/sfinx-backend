import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common';
import { ToBoolean } from '../../../common/decorators/transform.decorators';

export enum TopicSortBy {
  ID = 'id',
  NAME = 'name',
  ORDER_INDEX = 'orderIndex',
  CREATED_AT = 'createdAt',
}

export class FilterTopicDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: TopicSortBy,
    default: TopicSortBy.ORDER_INDEX,
  })
  @IsOptional()
  @IsEnum(TopicSortBy)
  override sortBy?: string = TopicSortBy.ORDER_INDEX;
}

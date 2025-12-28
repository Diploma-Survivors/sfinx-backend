import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginationQueryDto } from '../../../../common';
import { CommentType } from '../enums';

export enum CommentSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  TOP = 'top',
}

export class FilterCommentDto extends PaginationQueryDto {
  problemId?: number;

  @ApiPropertyOptional({
    description: 'Filter by comment type',
    enum: CommentType,
    example: CommentType.QUESTION,
  })
  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @ApiPropertyOptional({
    description: 'Filter by parent comment ID (null for top-level comments)',
    example: 42,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  parentId?: number;

  @ApiPropertyOptional({
    description: 'Sort order for comments',
    enum: CommentSortBy,
    default: CommentSortBy.TOP,
    example: CommentSortBy.TOP,
  })
  @IsOptional()
  @IsEnum(CommentSortBy)
  declare sortBy?: CommentSortBy;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common';

/**
 * Sort fields for comment reports
 */
export enum CommentReportSortBy {
  CREATED_AT = 'createdAt',
  RESOLVED_AT = 'resolvedAt',
  IS_RESOLVED = 'isResolved',
  REASON = 'reason',
}

/**
 * Filter and pagination DTO for comment reports
 */
export class FilterCommentReportDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by resolution status',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field for comment reports',
    enum: CommentReportSortBy,
    default: CommentReportSortBy.CREATED_AT,
    example: CommentReportSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CommentReportSortBy)
  declare sortBy?: CommentReportSortBy;
}

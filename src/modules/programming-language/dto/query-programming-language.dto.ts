import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common';
import { ToBoolean } from '../../../common/decorators/transform.decorators';

export class QueryProgrammingLanguageDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name (case-insensitive)',
    example: 'python',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

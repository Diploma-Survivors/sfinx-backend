import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class GetUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search by username, full name, or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by premium status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPremium?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by email verification status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  emailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by account status (active, banned, not_verified)',
  })
  @IsOptional()
  @IsString()
  status?: 'active' | 'banned' | 'not_verified';
}

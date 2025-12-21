import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryPermissionsDto {
  @ApiProperty({
    description: 'Filter permissions by resource name',
    example: 'problem',
    required: false,
  })
  @IsOptional()
  @IsString()
  resource?: string;
}

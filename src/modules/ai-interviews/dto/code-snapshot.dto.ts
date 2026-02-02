import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CodeSnapshotDto {
  @ApiProperty({
    description: 'Current code in the editor',
    example: 'function solution(nums) {\n  // your code here\n}',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Programming language',
    example: 'javascript',
  })
  @IsString()
  language: string;

  @ApiPropertyOptional({
    description: 'Timestamp when snapshot was taken',
    example: 1704067200000,
  })
  @IsOptional()
  timestamp?: number;
}

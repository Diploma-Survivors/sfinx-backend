import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddContestProblemDto {
  @ApiProperty({ description: 'Problem ID to add to contest' })
  @IsInt()
  problemId: number;

  @ApiPropertyOptional({ description: 'Points for this problem', default: 100 })
  @IsInt()
  @Min(1)
  @IsOptional()
  points?: number = 100;

  @ApiPropertyOptional({ description: 'Problem label (e.g., A, B, C)' })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ description: 'Display order (0-indexed)', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number = 0;
}

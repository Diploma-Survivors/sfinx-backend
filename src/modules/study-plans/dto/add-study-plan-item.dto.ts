import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddStudyPlanItemDto {
  @ApiProperty({ description: 'Problem ID', example: 1 })
  @IsInt()
  problemId: number;

  @ApiProperty({ description: 'Day number in the plan', example: 1 })
  @IsInt()
  @Min(1)
  dayNumber: number;

  @ApiPropertyOptional({
    description: 'Display order within the day',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    description: 'Optional note for this item',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ContestStatus } from '../enums';

export class AddProblemToContestDto {
  @ApiProperty({ description: 'Problem ID' })
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

  @ApiPropertyOptional({
    description:
      'Order index for the problem (optional, defaulting to array index)',
    example: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}

export class CreateContestDto {
  @ApiProperty({ description: 'Contest title', example: 'Weekly Contest #1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Contest description in markdown' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Contest rules in markdown' })
  @IsString()
  @IsOptional()
  rules?: string;

  @ApiProperty({ description: 'Contest start time' })
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({ description: 'Contest end time' })
  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @ApiPropertyOptional({
    description: 'Maximum participants (0 = unlimited)',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  maxParticipants?: number = 0;

  @ApiPropertyOptional({
    description: 'Contest status',
    enum: ContestStatus,
    default: ContestStatus.DRAFT,
  })
  @IsEnum(ContestStatus)
  @IsOptional()
  status?: ContestStatus = ContestStatus.DRAFT;

  @ApiPropertyOptional({
    description: 'Problems to include in contest',
    type: [AddProblemToContestDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddProblemToContestDto)
  @IsOptional()
  problems?: AddProblemToContestDto[];
}

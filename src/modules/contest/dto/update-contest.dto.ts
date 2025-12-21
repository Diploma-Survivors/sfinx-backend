import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ContestStatus } from '../enums/contest-status.enum';

export class UpdateContestDto {
  @ApiPropertyOptional({ description: 'Contest title' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Contest description in markdown' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Contest rules in markdown' })
  @IsString()
  @IsOptional()
  rules?: string;

  @ApiPropertyOptional({ description: 'Contest start time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startTime?: Date;

  @ApiPropertyOptional({ description: 'Contest end time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endTime?: Date;

  @ApiPropertyOptional({
    description: 'Contest status',
    enum: ContestStatus,
  })
  @IsEnum(ContestStatus)
  @IsOptional()
  status?: ContestStatus;

  @ApiPropertyOptional({
    description: 'Maximum participants (0 = unlimited)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  maxParticipants?: number;
}

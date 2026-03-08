import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartInterviewDto {
  @ApiProperty({ description: 'ID of the problem for the interview' })
  @IsNumber()
  @IsNotEmpty()
  problemId: number;

  @ApiPropertyOptional({
    description: 'Interview language',
    enum: ['en', 'vi'],
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'vi'])
  language?: string;
}

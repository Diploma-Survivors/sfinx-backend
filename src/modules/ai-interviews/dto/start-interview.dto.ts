import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InterviewMode,
  InterviewDifficulty,
  InterviewerPersonality,
} from '../enums';

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

  @ApiPropertyOptional({
    description: 'Interview mode/duration',
    enum: InterviewMode,
    default: InterviewMode.STANDARD,
  })
  @IsOptional()
  @IsEnum(InterviewMode)
  mode?: InterviewMode;

  @ApiPropertyOptional({
    description: 'Interview difficulty level',
    enum: InterviewDifficulty,
    default: InterviewDifficulty.ENTRY,
  })
  @IsOptional()
  @IsEnum(InterviewDifficulty)
  difficulty?: InterviewDifficulty;

  @ApiPropertyOptional({
    description: 'Interviewer personality',
    enum: InterviewerPersonality,
    default: InterviewerPersonality.EASY_GOING,
  })
  @IsOptional()
  @IsEnum(InterviewerPersonality)
  personality?: InterviewerPersonality;
}

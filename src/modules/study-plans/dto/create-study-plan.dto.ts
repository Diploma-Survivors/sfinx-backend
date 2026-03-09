import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { StudyPlanDifficulty } from '../enums/study-plan-difficulty.enum';
import { StudyPlanTranslationDto } from './study-plan-translation.dto';

export class CreateStudyPlanDto {
  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'dynamic-programming-mastery',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  slug: string;

  @ApiProperty({
    description: 'Difficulty level',
    enum: StudyPlanDifficulty,
    example: StudyPlanDifficulty.INTERMEDIATE,
  })
  @IsEnum(StudyPlanDifficulty)
  difficulty: StudyPlanDifficulty;

  @ApiProperty({
    description: 'Estimated number of days to complete',
    example: 14,
  })
  @IsInt()
  @Min(1)
  estimatedDays: number;

  @ApiPropertyOptional({
    description: 'Whether plan requires premium subscription',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiProperty({
    description: 'Translations (name and description in each language)',
    type: [StudyPlanTranslationDto],
    example: [
      {
        languageCode: 'en',
        name: 'DP Mastery',
        description: 'Master dynamic programming',
      },
      {
        languageCode: 'vi',
        name: 'Thành thạo QHĐ',
        description: 'Thành thạo quy hoạch động',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudyPlanTranslationDto)
  translations: StudyPlanTranslationDto[];

  @ApiPropertyOptional({
    description: 'Topic IDs to associate',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  topicIds?: number[];

  @ApiPropertyOptional({
    description: 'Tag IDs to associate',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];

  @ApiPropertyOptional({
    description: 'IDs of similar study plans',
    type: [Number],
    example: [2, 5],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  similarPlanIds?: number[];
}

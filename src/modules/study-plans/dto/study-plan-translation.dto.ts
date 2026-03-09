import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StudyPlanTranslationDto {
  @ApiProperty({ example: 'en', description: 'Language code (en, vi)' })
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @ApiProperty({
    example: 'DP Mastery',
    description: 'Plan name in the specified language',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Master dynamic programming step by step',
    description: 'Plan description in the specified language',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

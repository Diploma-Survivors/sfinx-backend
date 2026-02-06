import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranslationDto {
  @ApiProperty({ example: 'en', description: 'Language code (en, vi)' })
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @ApiProperty({
    example: 'Plan Name',
    description: 'Name in the specified language',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Plan Description',
    description: 'Description in the specified language',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

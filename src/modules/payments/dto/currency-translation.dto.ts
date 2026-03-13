import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CurrencyTranslationDto {
  @ApiProperty({ example: 'en', description: 'Language code (en, vi)' })
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @ApiProperty({
    example: 'US Dollar',
    description: 'Localized currency name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '$',
    description: 'Localized currency symbol',
    required: false,
  })
  @IsString()
  @IsOptional()
  symbol?: string;
}

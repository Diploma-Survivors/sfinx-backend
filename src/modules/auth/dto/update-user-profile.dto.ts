import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { Language } from '../enums';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'User full name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ description: 'User bio', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'User location', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'GitHub username', maxLength: 39 })
  @IsOptional()
  @IsString()
  @MaxLength(39)
  githubUsername?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'Personal website URL', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'Preferred language for UI',
    enum: Language,
    default: Language.EN,
  })
  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;
}

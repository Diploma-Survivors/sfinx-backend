import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProgrammingLanguageDto {
  @ApiProperty({
    description: 'Language name',
    example: 'Python 3',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug (lowercase, alphanumeric, hyphens only)',
    example: 'python3',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Judge0 language ID for code execution',
    example: 71,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  judge0Id?: number;

  @ApiPropertyOptional({
    description: 'Monaco editor language identifier',
    example: 'python',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  monacoLanguage?: string;

  @ApiPropertyOptional({
    description: 'Whether the language is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Display order index (lower numbers appear first)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

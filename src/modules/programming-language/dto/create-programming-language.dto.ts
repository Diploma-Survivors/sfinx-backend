import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProgrammingLanguageDto {
  @ApiProperty({
    description: 'Language name',
    example: 'Python 3',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

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

  @ApiProperty({
    description: 'Starter code template for this language',
    example: 'print("Hello, World!")',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  starterCode: string;
}

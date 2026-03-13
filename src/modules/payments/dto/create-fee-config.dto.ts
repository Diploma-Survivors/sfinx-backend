import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TranslationDto } from './translation.dto';

export class CreateFeeConfigDto {
  @ApiProperty({ description: 'Fee code (unique)', example: 'VAT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({
    description: 'Fee as a decimal fraction (0.08 = 8%)',
    example: 0.08,
  })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({
    description: 'Whether this fee is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [TranslationDto],
    description: 'Localized names/descriptions for this fee config',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  @IsOptional()
  translations?: TranslationDto[];
}

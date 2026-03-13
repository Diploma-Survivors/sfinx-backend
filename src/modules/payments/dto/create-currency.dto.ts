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
import { CurrencyTranslationDto } from './currency-translation.dto';

export class CreateCurrencyDto {
  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  code: string;

  @ApiProperty({ description: 'Currency name', example: 'US Dollar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Currency symbol', example: '$' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  symbol: string;

  @ApiProperty({
    description: 'Exchange rate multiplier to VND (VND=1, USD≈25500)',
    example: 25500,
  })
  @IsNumber()
  @Min(0)
  rateToVnd: number;

  @ApiPropertyOptional({
    description: 'Whether this currency is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [CurrencyTranslationDto],
    description: 'Localized names/symbols for this currency',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurrencyTranslationDto)
  @IsOptional()
  translations?: CurrencyTranslationDto[];
}

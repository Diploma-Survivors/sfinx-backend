import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTagDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'Two Pointers',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Tag type/category',
    example: 'technique',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({
    description: 'Tag description',
    example: 'Problems that use two pointers technique',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Color for UI display (hex code)',
    example: '#3B82F6',
  })
  @IsHexColor()
  @IsOptional()
  color?: string;
}

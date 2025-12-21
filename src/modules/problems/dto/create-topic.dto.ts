import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTopicDto {
  @ApiProperty({
    description: 'Topic name',
    example: 'Array',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Topic description',
    example: 'Array data structure problems',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Icon URL',
    example: 'https://example.com/icons/array.svg',
  })
  @IsUrl()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Display order index (lower numbers appear first)',
    example: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  orderIndex?: number = 0;

  @ApiPropertyOptional({
    description: 'Whether the topic is active',
    default: true,
  })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean = true;
}

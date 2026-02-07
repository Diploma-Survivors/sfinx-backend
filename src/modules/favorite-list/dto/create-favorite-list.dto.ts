import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFavoriteListDto {
  @ApiProperty({
    description: 'List name',
    example: 'My Favorite Problems',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'List icon (emoji)',
    example: '⭐',
    required: false,
    default: '📝',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiProperty({
    description: 'Whether list is public',
    required: false,
    default: false,
  })
  @IsOptional()
  isPublic?: boolean;
}

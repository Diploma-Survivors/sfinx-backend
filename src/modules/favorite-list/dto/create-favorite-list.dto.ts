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
    description: 'List description',
    example: 'A collection of difficult DP problems',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'List icon (URL or emoji)',
    example: 'https://example.com/icon.png',
    required: false,
    default:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRqUZVDZwW0xQG3s8dz4qBTZTwx4zWyyDvaYA&s',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;

  @ApiProperty({
    description: 'Whether list is public',
    required: false,
    default: false,
  })
  @IsOptional()
  isPublic?: boolean;
}

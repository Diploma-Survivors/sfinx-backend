import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Content Moderator',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'content-moderator',
  })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({
    description: 'Role description',
    example: 'Can moderate user-generated content',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Priority level (higher = more permissions in conflicts)',
    example: 5,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

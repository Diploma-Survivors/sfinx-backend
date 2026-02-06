import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'JavaScript' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '#F7DF1E' })
  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code',
  })
  color?: string;

  @ApiProperty({ example: 'All about JavaScript' })
  @IsString()
  @IsOptional()
  description?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertSystemParameterDto {
  @ApiProperty({ description: 'Parameter value (string / number / JSON)' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @IsString()
  @IsOptional()
  description?: string;
}

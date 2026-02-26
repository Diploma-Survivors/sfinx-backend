import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePromptConfigDto {
  @ApiProperty({
    description: 'Unique feature key used by the application',
    example: 'interviewer',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  featureName: string;

  @ApiPropertyOptional({
    description: 'Human-readable description',
    example: 'AI interviewer system prompt',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Prompt name as registered in Langfuse',
    example: 'interviewer',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  langfusePromptName: string;

  @ApiPropertyOptional({
    description: 'Langfuse label to fetch',
    example: 'production',
    default: 'production',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  langfuseLabel?: string;

  @ApiPropertyOptional({
    description: 'Whether this config is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

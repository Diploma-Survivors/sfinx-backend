import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class GenerateTokenDto {
  @ApiProperty({
    description: 'The UUID of the active interview session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  interviewId: string;

  @ApiPropertyOptional({
    description: 'Optional display name for the participant',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  displayName?: string;
}

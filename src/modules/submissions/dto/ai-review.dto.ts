import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AIReviewRequestDto {
  @ApiProperty({
    description: 'Custom prompt to guide the AI review (optional)',
    required: false,
  })
  customPrompt?: string;
}

export class AIReviewResponseDto {
  @ApiProperty({ description: 'AI-generated review in Markdown format' })
  review: string;

  @ApiProperty({
    description: 'Whether the review was generated fresh or cached',
  })
  cached: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the review was generated',
  })
  generatedAt?: Date;
}

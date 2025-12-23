import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressStatus } from '../../submissions/enums/progress-status.enum';
import { Tag } from '../entities/tag.entity';
import { Topic } from '../entities/topic.entity';
import { ProblemDifficulty } from '../enums/problem-difficulty.enum';

export class ProblemListItemDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @ApiProperty({ description: 'Problem title', example: 'Two Sum' })
  title: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'two-sum' })
  slug: string;

  @ApiProperty({
    description: 'Problem difficulty',
    enum: ProblemDifficulty,
  })
  difficulty: ProblemDifficulty;

  @ApiProperty({ description: 'Whether problem requires premium' })
  isPremium: boolean;

  @ApiProperty({ description: 'Acceptance rate percentage' })
  acceptanceRate: number;

  @ApiProperty({
    description: 'Tags associated with this problem',
    type: () => [Tag],
  })
  tags: Tag[];

  @ApiProperty({
    description: 'Topics associated with this problem',
    type: () => [Topic],
  })
  topics: Topic[];

  @ApiPropertyOptional({
    description:
      'User progress status (authenticated only). "not_started" is implied if null.',
    enum: ProgressStatus,
  })
  status?: ProgressStatus | null;

  // Admin Only Fields

  @ApiPropertyOptional({
    description: '[Admin Only] Whether problem is active/published',
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '[Admin Only] Total number of submissions',
  })
  totalSubmissions?: number;

  @ApiPropertyOptional({
    description: '[Admin Only] Total number of accepted submissions',
  })
  totalAccepted?: number;

  @ApiPropertyOptional({
    description: '[Admin Only] Number of testcases',
  })
  testcaseCount?: number;

  @ApiPropertyOptional({
    description: '[Admin Only] Time limit in milliseconds',
  })
  timeLimitMs?: number;

  @ApiPropertyOptional({
    description: '[Admin Only] Memory limit in kilobytes',
  })
  memoryLimitKb?: number;

  @ApiPropertyOptional({ description: '[Admin Only] Creation timestamp' })
  createdAt?: Date;

  @ApiPropertyOptional({ description: '[Admin Only] Last update timestamp' })
  updatedAt?: Date;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';
import { ProgressStatus } from '../../submissions/enums/progress-status.enum';
import { ProblemHint } from '../entities/problem.entity';
import { Tag } from '../entities/tag.entity';
import { Topic } from '../entities/topic.entity';
import { ProblemDifficulty } from '../enums/problem-difficulty.enum';

export class ProblemDetailDto {
  // ==========================================
  // Public Fields (Available to all users)
  // ==========================================

  @ApiProperty({ description: 'Unique identifier of the problem' })
  id: number;

  @ApiProperty({ description: 'Title of the problem', example: 'Two Sum' })
  title: string;

  @ApiProperty({
    description: 'URL-friendly slug for the problem',
    example: 'two-sum',
  })
  slug: string;

  @ApiProperty({
    description: 'Detailed description of the problem in Markdown format',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Input/Output constraints for the problem (e.g. n <= 10^5)',
  })
  constraints?: string;

  @ApiProperty({
    description: 'Difficulty level of the problem',
    enum: ProblemDifficulty,
  })
  difficulty: ProblemDifficulty;

  @ApiProperty({
    description: 'Indicates if the problem is exclusive to premium users',
  })
  isPremium: boolean;

  @ApiPropertyOptional({
    description: 'User progress status (authenticated users only)',
    enum: ProgressStatus,
  })
  status?: ProgressStatus | null;

  @ApiProperty({ description: 'Total number of submissions received' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total number of accepted submissions' })
  totalAccepted: number;

  @ApiProperty({ description: 'Calculated acceptance rate percentage' })
  acceptanceRate: number;

  @ApiProperty({
    description: 'Total number of unique users who attempted this problem',
  })
  totalAttempts: number;

  @ApiProperty({
    description:
      'Total number of unique users who successfully solved this problem',
  })
  totalSolved: number;

  @ApiProperty({
    description: 'Execution time limit in milliseconds',
  })
  timeLimitMs: number;

  @ApiProperty({
    description: 'Memory limit in kilobytes',
  })
  memoryLimitKb: number;

  @ApiProperty({
    description: 'List of hints available for the problem',
    type: () => [ProblemHint],
  })
  hints: ProblemHint[];

  @ApiProperty({
    description: 'Indicates if an official solution is available',
  })
  hasOfficialSolution: boolean;

  @ApiProperty({
    description: 'List of IDs of similar problems',
    example: [1, 2, 3],
  })
  similarProblems: number[];

  @ApiProperty({
    description: 'List of topics/categories associated with the problem',
    type: () => [Topic],
  })
  topics: Topic[];

  @ApiProperty({
    description: 'List of tags associated with the problem',
    type: () => [Tag],
  })
  tags: Tag[];

  // =================================================================
  // Admin / Restricted Fields (Requires 'problem:read_all' permission)
  // =================================================================

  @ApiPropertyOptional({
    description:
      '[Admin Only] Indicates if the problem is currently active/visible to public',
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '[Admin Only] Total number of hidden testcases',
  })
  testcaseCount?: number;

  @ApiPropertyOptional({
    description:
      '[Admin Only] Presigned URL to download the hidden testcase file',
  })
  testcaseFileUrl?: string;

  @ApiPropertyOptional({
    description: '[Admin Only] Content of the official solution in Markdown',
  })
  officialSolutionContent?: string;

  @ApiPropertyOptional({
    description:
      '[Admin Only] Difficulty rating based on community feedback (1-10)',
  })
  difficultyRating?: number;

  @ApiPropertyOptional({
    description:
      '[Admin Only] Average time taken to solve the problem (in seconds), mostly used for contests',
  })
  averageTimeToSolve?: number;

  @ApiPropertyOptional({
    description: '[Admin Only] Date and time when the problem was created',
  })
  createdAt?: Date;

  @ApiPropertyOptional({
    description: '[Admin Only] Date and time when the problem was last updated',
  })
  updatedAt?: Date;

  @ApiPropertyOptional({
    description: '[Admin Only] User who created the problem',
    type: () => User,
  })
  createdBy?: User;

  @ApiPropertyOptional({
    description: '[Admin Only] User who last updated the problem',
    type: () => User,
  })
  updatedBy?: User;
}

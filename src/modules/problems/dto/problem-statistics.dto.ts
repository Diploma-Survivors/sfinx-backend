import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionStatus } from '../../submissions/enums';
import { LanguageInfoDto } from '../../submissions/dto/submission-response.dto';

export class LanguageStatDto {
  @ApiProperty({
    description: 'Programming language',
    type: LanguageInfoDto,
  })
  language: LanguageInfoDto;

  @ApiProperty({ description: 'Total submissions in this language' })
  submissions: number;

  @ApiProperty({ description: 'Accepted submissions in this language' })
  acceptedSubmissions: number;

  @ApiProperty({ description: 'Acceptance rate percentage' })
  acceptanceRate: number;

  @ApiProperty({ description: 'Average runtime in ms' })
  averageRuntime: number;

  @ApiProperty({ description: 'Average memory in KB' })
  averageMemory: number;
}

export class VerdictCountDto {
  @ApiProperty({
    description: 'Submission verdict/status',
    enum: SubmissionStatus,
  })
  verdict: SubmissionStatus;

  @ApiProperty({ description: 'Number of submissions with this verdict' })
  count: number;

  @ApiProperty({ description: 'Percentage of total submissions' })
  percentage: number;
}

export class DistributionBucketDto {
  @ApiProperty({ description: 'Range label (e.g., "0-10ms")' })
  range: string;

  @ApiProperty({ description: 'Start value for sorting' })
  value: number;

  @ApiProperty({ description: 'Count of submissions in this range' })
  count: number;

  @ApiPropertyOptional({ description: 'Percentile value' })
  percentile?: number;
}

export class ProblemStatisticsDto {
  @ApiProperty({ description: 'Problem ID' })
  problemId: number;

  @ApiProperty({ description: 'Problem title' })
  problemTitle: string;

  @ApiProperty({ description: 'Total number of submissions' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total number of accepted submissions' })
  totalAccepted: number;

  @ApiProperty({ description: 'Acceptance rate as percentage' })
  acceptanceRate: number;

  @ApiProperty({ description: 'Total number of attempts' })
  totalAttempts: number;

  @ApiProperty({ description: 'Total solved count' })
  totalSolved: number;

  @ApiProperty({ description: 'Average time to solve in ms' })
  averageTimeToSolve: number;

  @ApiProperty({
    description: 'Submission breakdown by programming language',
    type: [LanguageStatDto],
  })
  languageStats: LanguageStatDto[];

  @ApiProperty({
    description: 'Distribution of submission verdicts',
    type: [VerdictCountDto],
  })
  verdicts: VerdictCountDto[];

  @ApiProperty({
    description: 'Runtime distribution',
    type: [DistributionBucketDto],
  })
  runtimeDistribution: DistributionBucketDto[];

  @ApiProperty({
    description: 'Memory distribution',
    type: [DistributionBucketDto],
  })
  memoryDistribution: DistributionBucketDto[];
}

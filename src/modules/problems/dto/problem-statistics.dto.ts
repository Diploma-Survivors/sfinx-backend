import { ApiProperty } from '@nestjs/swagger';
import { SubmissionStatus } from '../../submissions/enums';

export class LanguageBreakdownDto {
  @ApiProperty({ description: 'Programming language ID' })
  languageId: number;

  @ApiProperty({ description: 'Programming language name' })
  languageName: string;

  @ApiProperty({ description: 'Total submissions in this language' })
  submissionCount: number;

  @ApiProperty({ description: 'Accepted submissions in this language' })
  acceptedCount: number;
}

export class StatusDistributionDto {
  @ApiProperty({
    description: 'Submission status',
    enum: SubmissionStatus,
  })
  status: SubmissionStatus;

  @ApiProperty({ description: 'Number of submissions with this status' })
  count: number;

  @ApiProperty({ description: 'Percentage of total submissions' })
  percentage: number;
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

  @ApiProperty({ description: 'Number of unique users who attempted' })
  uniqueUsers: number;

  @ApiProperty({ description: 'Number of unique users who solved' })
  uniqueSolvers: number;

  @ApiProperty({
    description: 'Submission breakdown by programming language',
    type: [LanguageBreakdownDto],
  })
  languageBreakdown: LanguageBreakdownDto[];

  @ApiProperty({
    description: 'Distribution of submission statuses',
    type: [StatusDistributionDto],
  })
  statusDistribution: StatusDistributionDto[];
}

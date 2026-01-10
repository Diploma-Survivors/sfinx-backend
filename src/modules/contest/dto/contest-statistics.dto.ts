import { ApiProperty } from '@nestjs/swagger';
import { SubmissionStatus } from '../../submissions/enums';
import { ContestStatus } from '../enums';

export class ContestVerdictDto {
  @ApiProperty({
    description: 'Submission verdict',
    enum: SubmissionStatus,
  })
  verdict: SubmissionStatus;

  @ApiProperty({ description: 'Number of submissions with this verdict' })
  count: number;

  @ApiProperty({ description: 'Percentage of total submissions' })
  percentage: number;
}

export class ContestProblemStatsDto {
  @ApiProperty({ description: 'Problem ID' })
  problemId: number;

  @ApiProperty({ description: 'Problem order in contest (0-based)' })
  problemOrder: number;

  @ApiProperty({ description: 'Problem label (A, B, C, etc.)' })
  problemLabel: string;

  @ApiProperty({ description: 'Problem title' })
  title: string;

  @ApiProperty({ description: 'Problem difficulty' })
  difficulty: string;

  @ApiProperty({ description: 'Total submissions for this problem' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Number of users who solved this problem' })
  solvedCount: number;

  @ApiProperty({ description: 'Number of participants' })
  totalParticipants: number;

  @ApiProperty({ description: 'Percentage of participants who solved' })
  solvedPercentage: number;
}

export class ContestStatisticsDto {
  @ApiProperty({ description: 'Contest ID' })
  contestId: number;

  @ApiProperty({ description: 'Contest name' })
  contestName: string;

  @ApiProperty({
    description: 'Contest status',
    enum: ContestStatus,
  })
  status: ContestStatus;

  @ApiProperty({ description: 'Contest start time (ISO 8601)' })
  startTime: string;

  @ApiProperty({ description: 'Contest end time (ISO 8601)' })
  endTime: string;

  @ApiProperty({ description: 'Total number of active users (participants)' })
  activeUsers: number;

  @ApiProperty({ description: 'Total number of registered users' })
  totalRegistered: number;

  @ApiProperty({
    description: 'Number of users who submitted at least once',
  })
  totalParticipants: number;

  @ApiProperty({ description: 'Total number of submissions' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total number of accepted submissions' })
  totalAccepted: number;

  @ApiProperty({ description: 'Overall acceptance rate as percentage' })
  acceptanceRate: number;

  @ApiProperty({
    description: 'Distribution of submission verdicts',
    type: [ContestVerdictDto],
  })
  verdicts: ContestVerdictDto[];

  @ApiProperty({
    description: 'Per-problem statistics',
    type: [ContestProblemStatsDto],
  })
  problemStats: ContestProblemStatsDto[];
}

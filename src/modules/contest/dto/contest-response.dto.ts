import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContestStatus, UserContestStatus } from '../enums';

export class ContestProblemResponseDto {
  @ApiProperty({ description: 'Problem ID' })
  problemId: number;

  @ApiProperty({ description: 'Problem title' })
  title: string;

  @ApiProperty({ description: 'Problem slug' })
  slug: string;

  @ApiProperty({ description: 'Points for this problem' })
  points: number;

  @ApiProperty({ description: 'Display order' })
  orderIndex: number;

  @ApiPropertyOptional({ description: 'Problem label (e.g., A, B, C)' })
  label: string | null;

  @ApiPropertyOptional({ description: 'Problem difficulty' })
  difficulty: string;
}

export class ContestListResponseDto {
  @ApiProperty({ description: 'Contest ID' })
  id: number;

  @ApiProperty({ description: 'Contest title' })
  title: string;

  @ApiProperty({ description: 'Contest slug' })
  slug: string;

  @ApiProperty({ description: 'Contest status', enum: ContestStatus })
  status: ContestStatus;

  @ApiProperty({ description: 'Contest start time' })
  startTime: Date;

  @ApiProperty({ description: 'Contest end time' })
  endTime: Date;

  @ApiProperty({ description: 'Duration in minutes' })
  durationMinutes: number;

  @ApiProperty({ description: 'Number of participants' })
  participantCount: number;

  @ApiProperty({ description: 'Number of problems' })
  problemCount: number;
}

export class ContestDetailResponseDto extends ContestListResponseDto {
  @ApiPropertyOptional({ description: 'Contest description' })
  description: string | null;

  @ApiPropertyOptional({ description: 'Contest rules' })
  rules: string | null;

  @ApiProperty({ description: 'Maximum participants (0 = unlimited)' })
  maxParticipants: number;

  @ApiPropertyOptional({
    description: 'Problems in contest (hidden until start)',
    type: [ContestProblemResponseDto],
  })
  contestProblems?: ContestProblemResponseDto[];

  @ApiProperty({
    description: 'Whether current user is registered',
    enum: UserContestStatus,
    example: UserContestStatus.JOINED,
  })
  userStatus: UserContestStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

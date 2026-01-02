import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressStatus } from '../enums/progress-status.enum';
import { ProblemInfoDto } from './submission-response.dto';

export class UserProblemProgressResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: number;

  @ApiProperty({ description: 'Problem ID' })
  problemId: number;

  @ApiPropertyOptional({
    description: 'Problem information',
    type: ProblemInfoDto,
  })
  problem?: ProblemInfoDto;

  @ApiProperty({
    description: 'Progress status',
    enum: ProgressStatus,
  })
  status: ProgressStatus;

  @ApiProperty({ description: 'Total number of attempts' })
  totalAttempts: number;

  @ApiProperty({ description: 'Total accepted submissions' })
  totalAccepted: number;

  @ApiPropertyOptional({ description: 'Best runtime in milliseconds' })
  bestRuntimeMs: number | null;

  @ApiPropertyOptional({ description: 'Best memory usage in KB' })
  bestMemoryKb: number | null;

  @ApiProperty({ description: 'First attempt timestamp' })
  firstAttemptedAt: Date;

  @ApiPropertyOptional({ description: 'First solve timestamp' })
  firstSolvedAt: Date | null;

  @ApiPropertyOptional({ description: 'Last attempt timestamp' })
  lastAttemptedAt: Date | null;
}

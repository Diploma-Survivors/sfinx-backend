import { ApiProperty } from '@nestjs/swagger';
import { ProgressStatus, SubmissionStatus } from '../enums';
import { LanguageInfoDto, ProblemInfoDto } from './submission-response.dto';

export class PracticeHistorySubmissionDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: SubmissionStatus })
  status: SubmissionStatus;

  @ApiProperty()
  executionTime: number;

  @ApiProperty()
  memoryUsed: number;

  @ApiProperty()
  testcasesPassed: number;

  @ApiProperty()
  totalTestcases: number;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  problemId: number;

  @ApiProperty({ type: LanguageInfoDto })
  language: LanguageInfoDto;
}

export class UserPracticeHistoryDto {
  @ApiProperty({ type: ProblemInfoDto })
  problem: ProblemInfoDto;

  @ApiProperty({ enum: ProgressStatus })
  status: ProgressStatus;

  @ApiProperty({ nullable: true })
  lastSubmittedAt: Date | null;

  @ApiProperty({ enum: SubmissionStatus, nullable: true })
  lastResult: SubmissionStatus | null;

  @ApiProperty()
  submissionCount: number;

  @ApiProperty({ type: [PracticeHistorySubmissionDto] })
  submissions: PracticeHistorySubmissionDto[];
}

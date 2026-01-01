import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorDto } from '../../users/dtos/author.dto';
import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';

export class TestcaseResultDto {
  @ApiProperty({ description: 'Testcase ID', type: Number })
  testcaseId: number;

  @ApiProperty({ description: 'Testcase status' })
  status: string;

  @ApiPropertyOptional({ description: 'Input for the testcase' })
  input?: string;

  @ApiPropertyOptional({ description: 'Actual output' })
  actualOutput?: string;

  @ApiPropertyOptional({ description: 'Expected output' })
  expectedOutput?: string;

  @ApiPropertyOptional({ description: 'Execution time in ms' })
  executionTime?: number;

  @ApiPropertyOptional({ description: 'Memory used in KB' })
  memoryUsed?: number;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;

  @ApiPropertyOptional({ description: 'Standard error output' })
  stderr?: string;
}

export class FailedResultDto {
  @ApiPropertyOptional({ description: 'Error or status message' })
  message?: string;

  @ApiPropertyOptional({ description: 'Input that caused the failure' })
  input?: string;

  @ApiPropertyOptional({ description: 'Expected output' })
  expectedOutput?: string;

  @ApiPropertyOptional({ description: 'Actual output produced' })
  actualOutput?: string;

  @ApiPropertyOptional({ description: 'Standard error output' })
  stderr?: string;

  @ApiPropertyOptional({ description: 'Compilation output/error' })
  compileOutput?: string;
}

export class ProblemInfoDto {
  @ApiProperty({ description: 'Problem ID' })
  id: number;

  @ApiProperty({ description: 'Problem title' })
  title: string;

  @ApiPropertyOptional({ description: 'Problem slug' })
  slug?: string;

  @ApiProperty({ enum: ProblemDifficulty })
  difficulty?: ProblemDifficulty;
}

export class LanguageInfoDto {
  @ApiProperty({ description: 'Language ID' })
  id: number;

  @ApiProperty({ description: 'Language name' })
  name: string;
}

export class ContestInfoDto {
  @ApiProperty({ description: 'Contest ID' })
  id: number;

  @ApiProperty({ description: 'Contest title' })
  title: string;
}

export class SubmissionResponseDto {
  @ApiProperty({ description: 'Submission ID', type: Number })
  id: number;

  @ApiProperty({ description: 'Overall submission status' })
  status: string;

  @ApiPropertyOptional({ description: 'Execution time in ms' })
  executionTime?: number;

  @ApiPropertyOptional({ description: 'Memory used in KB' })
  memoryUsed?: number;

  @ApiProperty({ description: 'Number of testcases passed' })
  testcasesPassed: number;

  @ApiProperty({ description: 'Total number of testcases' })
  totalTestcases: number;

  @ApiPropertyOptional({
    description: 'Testcase results (for run mode)',
    type: [TestcaseResultDto],
  })
  testcaseResults?: TestcaseResultDto[];

  @ApiPropertyOptional({
    description: 'Failed result details',
    type: FailedResultDto,
  })
  failedResult?: FailedResultDto;

  @ApiPropertyOptional({ description: 'Compilation error' })
  compileError?: string;

  @ApiPropertyOptional({ description: 'Runtime error' })
  runtimeError?: string;

  @ApiProperty({ description: 'Submission timestamp' })
  submittedAt: Date;

  @ApiPropertyOptional({ description: 'Judging completion timestamp' })
  judgedAt?: Date;

  @ApiProperty({ description: 'Problem ID', type: Number })
  problemId: number;

  @ApiProperty({ description: 'Language ID', type: Number })
  languageId: number;

  @ApiPropertyOptional({
    description: 'Problem information',
    type: ProblemInfoDto,
  })
  problem?: ProblemInfoDto;

  @ApiPropertyOptional({
    description: 'Language information',
    type: LanguageInfoDto,
  })
  language?: LanguageInfoDto;

  @ApiPropertyOptional({
    description: 'User information (admin only)',
    type: AuthorDto,
  })
  user?: AuthorDto;

  @ApiPropertyOptional({
    description: 'Contest information (if submission is in contest)',
    type: ContestInfoDto,
  })
  contest?: ContestInfoDto;

  @ApiPropertyOptional({ description: 'Source code (own submissions only)' })
  sourceCode?: string;
}

export class SubmissionListResponseDto {
  @ApiProperty({ description: 'Submission ID', type: Number })
  id: number;

  @ApiProperty({ description: 'Overall submission status' })
  status: string;

  @ApiPropertyOptional({ description: 'Execution time in ms' })
  executionTime?: number;

  @ApiPropertyOptional({ description: 'Memory used in KB' })
  memoryUsed?: number;

  @ApiProperty({ description: 'Number of testcases passed' })
  testcasesPassed: number;

  @ApiProperty({ description: 'Total number of testcases' })
  totalTestcases: number;

  @ApiProperty({ description: 'Submission timestamp' })
  submittedAt: Date;

  @ApiProperty({ description: 'Problem ID', type: Number })
  problemId: number;

  @ApiProperty({ description: 'Language ID', type: Number })
  languageId: number;

  @ApiPropertyOptional({
    description: 'Problem information',
    type: ProblemInfoDto,
  })
  problem?: ProblemInfoDto;

  @ApiPropertyOptional({
    description: 'Language information',
    type: LanguageInfoDto,
  })
  language?: LanguageInfoDto;

  @ApiProperty({
    description: 'User information (admin only)',
    type: AuthorDto,
  })
  author?: AuthorDto;

  @ApiPropertyOptional({
    description: 'Contest information (if submission is in contest)',
    type: ContestInfoDto,
  })
  contest?: ContestInfoDto;
}

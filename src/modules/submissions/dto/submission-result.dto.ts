import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionStatus } from '../enums/submission-status.enum';

/**
 * Individual test result for a single testcase
 */
export class TestResultDto {
  @ApiPropertyOptional({
    description: 'Program output',
    example: '8',
  })
  stdout?: string;

  @ApiPropertyOptional({
    description: 'Stdin input provided to the program',
    example: '5 3',
  })
  stdin?: string;

  @ApiPropertyOptional({
    description: 'Error output if any',
    example: 'Error: Segmentation fault',
  })
  stderr?: string;

  @ApiProperty({
    description: 'Execution time in milliseconds',
    example: '0.123',
  })
  time: number;

  @ApiProperty({
    description: 'Memory usage in MB',
    example: 128,
  })
  memory: number;

  @ApiProperty({
    description: 'Submission token in judge0 container',
    example: 'd85cd024-1548-4165-96c7-7bc88673f194',
  })
  token: string;

  @ApiProperty({
    description: 'Submission status',
    enum: SubmissionStatus,
    example: SubmissionStatus.ACCEPTED,
  })
  status: SubmissionStatus;

  @ApiPropertyOptional({
    description: 'Expected output',
    example: '3\n',
  })
  expectedOutput?: string;

  @ApiPropertyOptional({
    description: 'Compilation output',
    example: 'Error at line 8',
  })
  compileOutput?: string;
}

/**
 * Result description for failed testcase
 */
export class ResultDescriptionDto {
  @ApiProperty({
    description: 'A descriptive message about the result of the submission.',
    example: 'Wrong answer',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'The input that was provided for the test case (from Judge0).',
    example: '5 10',
  })
  stdin?: string;

  @ApiPropertyOptional({
    description: 'The expected output for the given input.',
    example: '15',
  })
  expectedOutput?: string;

  @ApiPropertyOptional({
    description: 'The actual output produced by the submission (from Judge0).',
    example: '12',
  })
  stdout?: string;

  @ApiPropertyOptional({
    description: 'The standard error output, if any, from the submission.',
    example: 'Runtime Error: Division by zero.',
  })
  stderr?: string;

  @ApiPropertyOptional({
    description: 'Compilation output',
    example: 'Error at line 8',
  })
  compileOutput?: string;
}

/**
 * Aggregated submission result after all testcases are processed
 */
export class SubmissionResultDto {
  @ApiProperty({
    description: 'Overall submission status',
    enum: SubmissionStatus,
  })
  status: SubmissionStatus;

  @ApiProperty({ description: 'Total score (percentage)' })
  score: number;

  @ApiProperty({ description: 'Number of testcases passed' })
  passedTests: number;

  @ApiProperty({ description: 'Total number of testcases' })
  totalTests: number;

  @ApiPropertyOptional({
    description: 'Maximum runtime across all tests in ms',
  })
  runtime?: number;

  @ApiPropertyOptional({
    description: 'Maximum memory usage across all tests in KB',
  })
  memory?: number;

  @ApiPropertyOptional({
    description: 'First failed testcase details',
    type: ResultDescriptionDto,
  })
  resultDescription?: ResultDescriptionDto;

  @ApiPropertyOptional({
    description: 'All test results (for run mode)',
    type: [TestResultDto],
  })
  testResults?: TestResultDto[];
}

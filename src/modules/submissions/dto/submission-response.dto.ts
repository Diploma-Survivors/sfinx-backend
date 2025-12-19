import { ApiProperty } from '@nestjs/swagger';

export class TestcaseResultDto {
  @ApiProperty({ description: 'Testcase ID', type: Number })
  testcaseId: number;

  @ApiProperty({ description: 'Testcase status' })
  status: string;

  @ApiProperty({ description: 'Actual output', required: false })
  actualOutput?: string;

  @ApiProperty({ description: 'Expected output', required: false })
  expectedOutput?: string;

  @ApiProperty({ description: 'Execution time in ms', required: false })
  executionTime?: number;

  @ApiProperty({ description: 'Memory used in KB', required: false })
  memoryUsed?: number;

  @ApiProperty({ description: 'Error message', required: false })
  error?: string;
}

export class SubmissionResponseDto {
  @ApiProperty({ description: 'Submission ID', type: Number })
  id: number;

  @ApiProperty({ description: 'Overall submission status' })
  status: string;

  @ApiProperty({ description: 'Execution time in ms', required: false })
  executionTime?: number;

  @ApiProperty({ description: 'Memory used in KB', required: false })
  memoryUsed?: number;

  @ApiProperty({ description: 'Number of testcases passed' })
  testcasesPassed: number;

  @ApiProperty({ description: 'Total number of testcases' })
  totalTestcases: number;

  @ApiProperty({
    description: 'Testcase results',
    type: [TestcaseResultDto],
    required: false,
  })
  testcaseResults?: TestcaseResultDto[];

  @ApiProperty({ description: 'Compilation error', required: false })
  compileError?: string;

  @ApiProperty({ description: 'Runtime error', required: false })
  runtimeError?: string;

  @ApiProperty({ description: 'Submission timestamp' })
  submittedAt: Date;

  @ApiProperty({ description: 'Problem ID', type: Number })
  problemId: number;

  @ApiProperty({ description: 'Language ID', type: Number })
  languageId: number;
}

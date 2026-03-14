import { Injectable, Logger } from '@nestjs/common';

import { decodeBase64 } from 'src/common';
import { Judge0Service } from '../../judge0/judge0.service';
import {
  ResultDescriptionDto,
  TestResultDto,
} from '../dto/submission-result.dto';
import { SubmissionStatus } from '../enums/submission-status.enum';

/**
 * Service responsible for generating user-friendly result descriptions
 * Handles error message formatting and detail enrichment
 */
@Injectable()
export class ResultDescriptionGeneratorService {
  private readonly logger = new Logger(ResultDescriptionGeneratorService.name);

  constructor(private readonly judge0Service: Judge0Service) {}

  /**
   * Generate result description based on test result
   */
  generate(firstFailedTest: TestResultDto | null): ResultDescriptionDto {
    if (!firstFailedTest) {
      return {
        message: 'All test cases passed',
      };
    }

    switch (firstFailedTest.status) {
      case SubmissionStatus.WRONG_ANSWER:
        return {
          message: 'Wrong answer',
          stdin: firstFailedTest.stdin || 'N/A',
          expectedOutput: firstFailedTest.expectedOutput || 'N/A',
          stdout: firstFailedTest.stdout || '(empty)',
          compileOutput: firstFailedTest.compileOutput,
        };

      case SubmissionStatus.TIME_LIMIT_EXCEEDED: {
        const tleSuffix = firstFailedTest.stderr
          ? `\n${firstFailedTest.stderr}`
          : ' — check for infinite loops or O(n²) algorithms on large inputs.';
        return {
          message: `Time limit exceeded${tleSuffix}`,
          stdin: firstFailedTest.stdin,
          expectedOutput: firstFailedTest.expectedOutput,
          stdout: firstFailedTest.stdout,
          compileOutput: firstFailedTest.compileOutput,
          stderr: firstFailedTest.stderr,
        };
      }

      case SubmissionStatus.MEMORY_LIMIT_EXCEEDED: {
        const mleSuffix = firstFailedTest.stderr
          ? `\n${firstFailedTest.stderr}`
          : ' — check for large allocations, unbounded recursion, or memory leaks.';
        return {
          message: `Memory limit exceeded${mleSuffix}`,
          stderr: firstFailedTest.stderr,
          stdin: firstFailedTest.stdin,
          expectedOutput: firstFailedTest.expectedOutput,
          stdout: firstFailedTest.stdout,
          compileOutput: firstFailedTest.compileOutput,
        };
      }

      case SubmissionStatus.RUNTIME_ERROR: {
        const errorDetail = firstFailedTest.stderr || firstFailedTest.stdout;
        const reSuffix = errorDetail
          ? `:\n${errorDetail}`
          : ' — your program crashed. Common causes: null/undefined access, array index out of bounds, division by zero, or stack overflow.';
        return {
          message: `Runtime error${reSuffix}`,
          stderr: firstFailedTest.stderr || firstFailedTest.stdout,
          stdin: firstFailedTest.stdin,
          expectedOutput: firstFailedTest.expectedOutput,
          compileOutput: firstFailedTest.compileOutput,
        };
      }

      case SubmissionStatus.COMPILATION_ERROR: {
        // compile_output holds the actual compiler errors; stderr may be empty
        const compileDetail =
          firstFailedTest.compileOutput || firstFailedTest.stderr;
        return {
          message: `Compilation error${compileDetail ? `:\n${compileDetail}` : ''}`,
          stderr: firstFailedTest.stderr,
          compileOutput: firstFailedTest.compileOutput || '',
        };
      }

      default: {
        const unknownDetail = firstFailedTest.stderr || firstFailedTest.stdout;
        return {
          message: `An unexpected error occurred${unknownDetail ? `:\n${unknownDetail}` : '. Please try again or report the issue.'}`,
          stderr: firstFailedTest.stderr,
          compileOutput: firstFailedTest.compileOutput,
        };
      }
    }
  }

  /**
   * Enrich failed test result with additional details (e.g. inputs, outputs) from Judge0.
   */
  async enrichFailedTestDetails(
    failedTest: TestResultDto,
  ): Promise<TestResultDto> {
    try {
      const detailedResult = await this.judge0Service.getSubmissionDetails(
        failedTest.token ?? '',
      );

      return {
        ...failedTest,
        expectedOutput: decodeBase64(detailedResult.expected_output),
        stdin: decodeBase64(detailedResult.stdin),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch submission details for token ${failedTest.token}`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return failedTest;
    }
  }
}

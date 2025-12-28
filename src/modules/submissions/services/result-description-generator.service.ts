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
          stdout: firstFailedTest.stdout || 'N/A',
        };

      case SubmissionStatus.TIME_LIMIT_EXCEEDED:
        return {
          message: `Time limit exceeded${firstFailedTest.stderr ? `\n${firstFailedTest.stderr}` : ''}`,
        };

      case SubmissionStatus.MEMORY_LIMIT_EXCEEDED:
        return {
          message: `Memory limit exceeded${firstFailedTest.stderr ? `\n${firstFailedTest.stderr}` : ''}`,
          stderr: firstFailedTest.stderr,
        };

      case SubmissionStatus.RUNTIME_ERROR:
        return {
          message: `Runtime error${firstFailedTest.stderr ? `\n${firstFailedTest.stderr}` : ''}`,
          stderr: firstFailedTest.stderr,
        };

      case SubmissionStatus.COMPILATION_ERROR:
        return {
          message: `Compilation error${firstFailedTest.stderr ? `\n${firstFailedTest.stderr}` : ''}`,
          stderr: firstFailedTest.stderr,
          compileOutput: firstFailedTest.compileOutput || '',
        };

      default:
        return {
          message: 'Unknown error occurred',
        };
    }
  }

  /**
   * Enrich wrong answer test result with additional details from Judge0
   */
  async enrichWrongAnswerDetails(
    failedTest: TestResultDto,
  ): Promise<TestResultDto> {
    try {
      const detailedResult = await this.judge0Service.getSubmissionDetails(
        failedTest.token,
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

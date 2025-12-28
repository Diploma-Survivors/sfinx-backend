import { Injectable } from '@nestjs/common';

import { Problem } from '../../problems/entities/problem.entity';
import { TestResultDto } from '../dto/submission-result.dto';
import { SubmissionStatus } from '../enums/submission-status.enum';
import { SubmissionStats } from '../interfaces/submission-stats.interface';

/**
 * Service responsible for calculating submission statistics
 * Pure calculation logic with no external dependencies
 */
@Injectable()
export class SubmissionStatsCalculatorService {
  /**
   * Calculate submission statistics from test results
   * Includes time and memory limit checking and status determination
   */
  calculateStats(results: TestResultDto[], problem: Problem): SubmissionStats {
    const totalTests = results.length;
    let passedTests = 0;
    let sumRuntime = 0;
    let sumMemory = 0;
    let firstFailedTest: TestResultDto | null = null;

    for (const result of results) {
      sumRuntime += Number(result.time) || 0;
      sumMemory += Number(result.memory) || 0;

      if (result.status === SubmissionStatus.ACCEPTED) {
        passedTests++;
      } else {
        // Check if runtime error is actually TLE or MLE
        let checkedResult = this.checkTimeLimitExceeded(result, problem);
        checkedResult = this.checkMemoryLimitExceeded(checkedResult, problem);

        // Only set the first failed test
        if (firstFailedTest === null) {
          firstFailedTest = checkedResult;
        }
      }
    }

    const overallStatus = this.determineOverallStatus(
      passedTests,
      totalTests,
      firstFailedTest,
    );

    return {
      overallStatus,
      passedTests,
      totalTests,
      sumRuntime,
      sumMemory,
      firstFailedTest,
    };
  }

  /**
   * Determine overall submission status based on test results
   */
  determineOverallStatus(
    passedTests: number,
    totalTests: number,
    firstFailedTest: TestResultDto | null,
  ): SubmissionStatus {
    if (passedTests === totalTests) {
      return SubmissionStatus.ACCEPTED;
    }

    if (!firstFailedTest) {
      return SubmissionStatus.UNKNOWN_ERROR;
    }

    // Return the status of the first failed test
    return firstFailedTest.status;
  }

  /**
   * Check if a runtime error is actually a time limit exceeded
   */
  checkTimeLimitExceeded(
    testResult: TestResultDto,
    problem: Problem,
  ): TestResultDto {
    if (testResult.status === SubmissionStatus.RUNTIME_ERROR) {
      // Convert time from seconds to milliseconds for comparison
      const timeMs = Number(testResult.time) * 1000;
      if (timeMs > problem.timeLimitMs) {
        return {
          ...testResult,
          status: SubmissionStatus.TIME_LIMIT_EXCEEDED,
        };
      }
    }
    return testResult;
  }

  /**
   * Check if a runtime error is actually a memory limit exceeded
   */
  checkMemoryLimitExceeded(
    testResult: TestResultDto,
    problem: Problem,
  ): TestResultDto {
    if (testResult.status === SubmissionStatus.RUNTIME_ERROR) {
      // Memory is already in kilobytes, compare directly
      const memoryKb = Number(testResult.memory);
      if (memoryKb > problem.memoryLimitKb) {
        return {
          ...testResult,
          status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
        };
      }
    }
    return testResult;
  }
}

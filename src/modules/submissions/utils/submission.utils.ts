import { SubmissionStatus } from '../enums/submission-status.enum';
import type { TestCaseResult } from '../interfaces/testcase-result.interface';

/**
 * Utility functions for submission processing
 */

/**
 * Check if a submission status is a terminal state (no longer pending)
 */
export function isTerminalStatus(status: SubmissionStatus): boolean {
  return (
    status !== SubmissionStatus.PENDING && status !== SubmissionStatus.RUNNING
  );
}

/**
 * Check if a submission status is successful
 */
export function isSuccessfulStatus(status: SubmissionStatus): boolean {
  return status === SubmissionStatus.ACCEPTED;
}

/**
 * Check if a submission status indicates an error
 */
export function isErrorStatus(status: SubmissionStatus): boolean {
  const errorStatuses: SubmissionStatus[] = [
    SubmissionStatus.COMPILATION_ERROR,
    SubmissionStatus.RUNTIME_ERROR,
    SubmissionStatus.UNKNOWN_ERROR,
    SubmissionStatus.SIGSEGV,
    SubmissionStatus.SIGXFSZ,
    SubmissionStatus.SIGFPE,
    SubmissionStatus.SIGABRT,
    SubmissionStatus.NZEC,
  ];
  return errorStatuses.includes(status);
}

/**
 * Check if a submission status indicates a timeout
 */
export function isTimeoutStatus(status: SubmissionStatus): boolean {
  return status === SubmissionStatus.TIME_LIMIT_EXCEEDED;
}

/**
 * Calculate the pass rate from testcase results
 */
export function calculatePassRate(results: TestCaseResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((tc) => tc.status === 'Accepted').length;
  return (passed / results.length) * 100;
}

/**
 * Get overall status from testcase results
 */
export function determineOverallStatus(
  results: TestCaseResult[],
): SubmissionStatus {
  if (results.length === 0) return SubmissionStatus.UNKNOWN_ERROR;

  // Check for compilation error (would be on first testcase)
  const compilationError = results.find((tc) =>
    tc.status?.toLowerCase().includes('compilation'),
  );
  if (compilationError) return SubmissionStatus.COMPILATION_ERROR;

  // Check for all passed
  const allPassed = results.every((tc) => tc.status === 'Accepted');
  if (allPassed) return SubmissionStatus.ACCEPTED;

  // Find first failed testcase
  const firstFailed = results.find((tc) => tc.status !== 'Accepted');
  if (!firstFailed) return SubmissionStatus.ACCEPTED;

  // Map common Judge0 statuses to our enum
  const statusMap: Record<string, SubmissionStatus> = {
    'wrong answer': SubmissionStatus.WRONG_ANSWER,
    'time limit exceeded': SubmissionStatus.TIME_LIMIT_EXCEEDED,
    'runtime error (sigsegv)': SubmissionStatus.SIGSEGV,
    'runtime error (sigxfsz)': SubmissionStatus.SIGXFSZ,
    'runtime error (sigfpe)': SubmissionStatus.SIGFPE,
    'runtime error (sigabrt)': SubmissionStatus.SIGABRT,
    'runtime error (nzec)': SubmissionStatus.NZEC,
    'compilation error': SubmissionStatus.COMPILATION_ERROR,
  };

  const lowerStatus = firstFailed.status?.toLowerCase() ?? '';
  return statusMap[lowerStatus] ?? SubmissionStatus.RUNTIME_ERROR;
}

/**
 * Calculate average runtime from testcase results
 */
export function calculateAverageRuntime(
  results: TestCaseResult[],
): number | null {
  const runtimes = results
    .filter((tc) => tc.executionTime !== undefined)
    .map((tc) => tc.executionTime!);

  if (runtimes.length === 0) return null;
  return runtimes.reduce((sum, t) => sum + t, 0) / runtimes.length;
}

/**
 * Calculate max memory from testcase results
 */
export function calculateMaxMemory(results: TestCaseResult[]): number | null {
  const memories = results
    .filter((tc) => tc.memoryUsed !== undefined)
    .map((tc) => tc.memoryUsed!);

  if (memories.length === 0) return null;
  return Math.max(...memories);
}

/**
 * Format runtime for display (ms to human-readable)
 */
export function formatRuntime(runtimeMs: number | null | undefined): string {
  if (runtimeMs === null || runtimeMs === undefined) return 'N/A';
  if (runtimeMs < 1) return '<1 ms';
  if (runtimeMs < 1000) return `${Math.round(runtimeMs)} ms`;
  return `${(runtimeMs / 1000).toFixed(2)} s`;
}

/**
 * Format memory for display (KB to human-readable)
 */
export function formatMemory(memoryKb: number | null | undefined): string {
  if (memoryKb === null || memoryKb === undefined) return 'N/A';
  if (memoryKb < 1024) return `${Math.round(memoryKb)} KB`;
  return `${(memoryKb / 1024).toFixed(2)} MB`;
}

/**
 * Truncate output for display
 */
export function truncateOutput(
  output: string | undefined,
  maxLength = 500,
): string {
  if (!output) return '';
  if (output.length <= maxLength) return output;
  return output.substring(0, maxLength) + '...(truncated)';
}

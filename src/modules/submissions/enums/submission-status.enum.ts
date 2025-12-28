/**
 * User-friendly submission status enum
 * Normalized from Judge0 technical status codes for better user understanding
 */
export enum SubmissionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  ACCEPTED = 'ACCEPTED',
  WRONG_ANSWER = 'WRONG_ANSWER',
  TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Maps Judge0 status IDs to user-friendly submission statuses
 * Technical signals (SIGSEGV, SIGFPE, etc.) are normalized to RUNTIME_ERROR
 */
export const judge0StatusMap: Record<number, SubmissionStatus> = {
  1: SubmissionStatus.PENDING, // In Queue
  2: SubmissionStatus.RUNNING, // Processing
  3: SubmissionStatus.ACCEPTED, // Accepted
  4: SubmissionStatus.WRONG_ANSWER, // Wrong Answer
  5: SubmissionStatus.TIME_LIMIT_EXCEEDED, // Time Limit Exceeded
  6: SubmissionStatus.COMPILATION_ERROR, // Compilation Error
  7: SubmissionStatus.RUNTIME_ERROR, // SIGSEGV (Segmentation fault)
  8: SubmissionStatus.MEMORY_LIMIT_EXCEEDED, // SIGXFSZ (File size limit exceeded)
  9: SubmissionStatus.RUNTIME_ERROR, // SIGFPE (Floating point exception)
  10: SubmissionStatus.RUNTIME_ERROR, // SIGABRT (Abort signal)
  11: SubmissionStatus.RUNTIME_ERROR, // NZEC (Non-zero exit status)
  12: SubmissionStatus.RUNTIME_ERROR, // Other runtime error
  13: SubmissionStatus.UNKNOWN_ERROR, // Internal Error
  14: SubmissionStatus.UNKNOWN_ERROR, // Exec Format Error
};

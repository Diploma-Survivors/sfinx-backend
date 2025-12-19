/**
 * Interface for individual testcase result
 * Used when updating submission results from Judge0
 */
export interface TestCaseResult {
  /**
   * Testcase identifier
   */
  testcaseId?: number;

  /**
   * Status of the testcase execution
   */
  status: string;

  /**
   * Actual output produced by the code
   */
  actualOutput?: string;

  /**
   * Expected output for the testcase
   */
  expectedOutput?: string;

  /**
   * Input for the testcase
   */
  input?: string;

  /**
   * Execution time in milliseconds
   */
  executionTime?: number;

  /**
   * Memory used in KB
   */
  memoryUsed?: number;

  /**
   * Error message if any
   */
  error?: string;

  /**
   * Standard error output
   */
  stderr?: string;
}

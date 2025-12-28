import { TestResultDto } from '../dto/submission-result.dto';
import { SubmissionStatus } from '../enums/submission-status.enum';

/**
 * Statistics calculated from submission test results
 */
export interface SubmissionStats {
  overallStatus: SubmissionStatus;
  passedTests: number;
  totalTests: number;
  sumRuntime: number;
  sumMemory: number;
  firstFailedTest: TestResultDto | null;
}

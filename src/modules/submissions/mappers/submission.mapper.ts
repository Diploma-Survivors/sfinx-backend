import { Submission } from '../entities/submission.entity';
import { SubmissionResponseDto } from '../dto/submission-response.dto';

/**
 * Mapper for converting Submission entities to DTOs
 * Pure function following Single Responsibility Principle
 */
export class SubmissionMapper {
  /**
   * Map Submission entity to SubmissionResponseDto
   */
  static toResponseDto(submission: Submission): SubmissionResponseDto {
    // Extract data from JSONB structure
    const compileError = submission.resultDescription?.compileOutput;
    const runtimeError = submission.resultDescription?.stderr;

    return {
      id: submission.id,
      status: submission.status,
      executionTime: submission.runtimeMs ?? undefined,
      memoryUsed: submission.memoryKb ?? undefined,
      testcasesPassed: submission.passedTestcases,
      totalTestcases: submission.totalTestcases,
      compileError: compileError ?? undefined,
      runtimeError: runtimeError ?? undefined,
      submittedAt: submission.submittedAt,
      problemId: submission.problem?.id,
      languageId: submission.language?.id,
    };
  }
}

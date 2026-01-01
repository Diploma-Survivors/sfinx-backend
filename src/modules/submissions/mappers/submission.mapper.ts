import {
  LanguageInfoDto,
  ProblemInfoDto,
  SubmissionListResponseDto,
  SubmissionResponseDto,
  UserInfoDto,
} from '../dto/submission-response.dto';
import { Submission } from '../entities/submission.entity';

export interface MapperOptions {
  includeSourceCode?: boolean;
  includeUser?: boolean;
}

/**
 * Mapper for converting Submission entities to DTOs
 * Pure function following Single Responsibility Principle
 */
export class SubmissionMapper {
  /**
   * Map Submission entity to SubmissionResponseDto (detailed)
   */
  static toResponseDto(
    submission: Submission,
    options: MapperOptions = {},
  ): SubmissionResponseDto {
    const { includeSourceCode = false, includeUser = false } = options;

    // Build problem info if loaded
    const problem: ProblemInfoDto | undefined = submission.problem
      ? {
          id: submission.problem.id,
          title: submission.problem.title,
          slug: submission.problem.slug,
        }
      : undefined;

    // Build language info if loaded
    const language: LanguageInfoDto | undefined = submission.language
      ? {
          id: submission.language.id,
          name: submission.language.name,
        }
      : undefined;

    // Build user info if loaded and requested
    const user: UserInfoDto | undefined =
      includeUser && submission.user
        ? {
            id: submission.user.id,
            username: submission.user.username,
          }
        : undefined;

    return {
      id: submission.id,
      status: submission.status,
      executionTime: submission.runtimeMs ?? undefined,
      memoryUsed: submission.memoryKb ?? undefined,
      testcasesPassed: submission.passedTestcases,
      totalTestcases: submission.totalTestcases,
      resultDescription: submission.resultDescription
        ? {
            ...submission.resultDescription,
          }
        : { message: 'Unknown Error' },
      submittedAt: submission.submittedAt,
      judgedAt: submission.judgedAt ?? undefined,
      problemId: submission.problem?.id ?? 0,
      languageId: submission.language?.id ?? 0,
      problem,
      language,
      user,
      sourceCode: includeSourceCode
        ? (submission.sourceCode ?? undefined)
        : undefined,
    };
  }

  /**
   * Map Submission entity to SubmissionListResponseDto (lightweight)
   */
  static toListResponseDto(submission: Submission): SubmissionListResponseDto {
    // Build problem info if loaded
    const problem: ProblemInfoDto | undefined = submission.problem
      ? {
          id: submission.problem.id,
          title: submission.problem.title,
          slug: submission.problem.slug,
        }
      : undefined;

    // Build language info if loaded
    const language: LanguageInfoDto | undefined = submission.language
      ? {
          id: submission.language.id,
          name: submission.language.name,
        }
      : undefined;

    return {
      id: submission.id,
      status: submission.status,
      executionTime: submission.runtimeMs ?? undefined,
      memoryUsed: submission.memoryKb ?? undefined,
      testcasesPassed: submission.passedTestcases,
      totalTestcases: submission.totalTestcases,
      submittedAt: submission.submittedAt,
      problemId: submission.problem?.id ?? 0,
      languageId: submission.language?.id ?? 0,
      problem,
      language,
    };
  }

  /**
   * Map array of submissions to list DTOs
   */
  static toListResponseDtos(
    submissions: Submission[],
  ): SubmissionListResponseDto[] {
    return submissions.map((s) => this.toListResponseDto(s));
  }

  /**
   * Map array of submissions to detailed DTOs
   */
  static toResponseDtos(
    submissions: Submission[],
    options: MapperOptions = {},
  ): SubmissionResponseDto[] {
    return submissions.map((s) => this.toResponseDto(s, options));
  }
}

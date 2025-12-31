import { Submission } from '../entities/submission.entity';
import {
  FailedResultDto,
  LanguageInfoDto,
  ProblemInfoDto,
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from '../dto/submission-response.dto';
import { AuthorDto } from '../../users/dtos/author.dto';
import { StorageService } from '../../storage/storage.service';
import { getAvatarUrl } from '../../../common/utils';

export interface MapperOptions {
  includeSourceCode?: boolean;
  includeUser?: boolean;
  storageService?: StorageService;
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
    const {
      includeSourceCode = false,
      includeUser = false,
      storageService,
    } = options;

    // Extract error data from JSONB structure
    const compileError = submission.resultDescription?.compileOutput;
    const runtimeError = submission.resultDescription?.stderr;

    // Build failed result if exists
    const failedResult = submission.resultDescription
      ? this.toFailedResultDto(submission.resultDescription)
      : undefined;

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
    const user: AuthorDto | undefined =
      includeUser && submission.user && storageService
        ? {
            id: submission.user.id,
            username: submission.user.username,
            avatarUrl:
              getAvatarUrl(submission.user.avatarKey, storageService) ??
              undefined,
            isPremium: submission.user.isPremium,
          }
        : undefined;

    return {
      id: submission.id,
      status: submission.status,
      executionTime: submission.runtimeMs ?? undefined,
      memoryUsed: submission.memoryKb ?? undefined,
      testcasesPassed: submission.passedTestcases,
      totalTestcases: submission.totalTestcases,
      failedResult,
      compileError: compileError ?? undefined,
      runtimeError: runtimeError ?? undefined,
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
  static toListResponseDto(
    submission: Submission,
    storageService?: StorageService,
  ): SubmissionListResponseDto {
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

    // Build author info if loaded
    const author: AuthorDto | undefined =
      submission.user && storageService
        ? {
            id: submission.user.id,
            username: submission.user.username,
            avatarUrl:
              getAvatarUrl(submission.user.avatarKey, storageService) ??
              undefined,
            isPremium: submission.user.isPremium,
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
      author,
    };
  }

  /**
   * Map ResultDescription to FailedResultDto
   */
  private static toFailedResultDto(
    result: NonNullable<Submission['resultDescription']>,
  ): FailedResultDto {
    return {
      message: result.message ?? undefined,
      input: result.input ?? undefined,
      expectedOutput: result.expectedOutput ?? undefined,
      actualOutput: result.actualOutput ?? undefined,
      stderr: result.stderr ?? undefined,
      compileOutput: result.compileOutput ?? undefined,
    };
  }

  /**
   * Map array of submissions to list DTOs
   */
  static toListResponseDtos(
    submissions: Submission[],
    storageService?: StorageService,
  ): SubmissionListResponseDto[] {
    return submissions.map((s) => this.toListResponseDto(s, storageService));
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

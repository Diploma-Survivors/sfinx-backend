import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResultDto } from '../../../common';
import { Submission } from '../entities/submission.entity';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus, SubmissionStatus } from '../enums';
import { UserProblemProgressResponseDto } from '../dto/user-problem-progress-response.dto';
import { UserProblemProgressDetailResponseDto } from '../dto/user-problem-progress-detail-response.dto';
import { PracticeSortBy } from '../enums/practice-sort-by.enum';
import { UserPracticeHistoryDto } from '../dto/user-practice-history.dto';
import { GetPracticeHistoryDto } from '../dto/get-practice-history.dto';

@Injectable()
export class UserProgressService {
  constructor(
    @InjectRepository(UserProblemProgress)
    private readonly progressRepository: Repository<UserProblemProgress>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  /**
   * Get user's progress on a specific problem
   */
  async getUserProgress(
    userId: number,
    problemId: number,
  ): Promise<UserProblemProgressDetailResponseDto | null> {
    const progress = await this.progressRepository.findOne({
      where: { userId, problemId },
      relations: ['problem', 'bestSubmission', 'bestSubmission.language'],
    });

    if (!progress) return null;

    return this.mapToDetailDto(progress);
  }

  /**
   * Get all problem progress for a user with pagination
   */
  async getAllUserProgress(
    userId: number,
    query: GetPracticeHistoryDto,
  ): Promise<PaginatedResultDto<UserPracticeHistoryDto>> {
    const page = query.page ?? 1;
    const limit = query.take;
    const skip = query.skip;

    // 1. Fetch paginated progress records with simplified problem fields
    const queryBuilder = this.progressRepository
      .createQueryBuilder('progress')
      .leftJoin('progress.problem', 'problem')
      .select([
        'progress.userId', // Include PK
        'progress.problemId', // Include PK
        'progress.status',
        'progress.lastAttemptedAt',
        'progress.totalAttempts',
        'problem.id',
        'problem.title',
        'problem.slug',
        'problem.difficulty',
      ])
      .where('progress.userId = :userId', { userId });

    // Filter by status
    if (query.status) {
      queryBuilder.andWhere('progress.status = :status', {
        status: query.status,
      });
    }

    // Filter by difficulty
    if (query.difficulty) {
      queryBuilder.andWhere('problem.difficulty = :difficulty', {
        difficulty: query.difficulty,
      });
    }

    // Sorting
    const sortOrder = query.sortOrder ?? 'DESC';

    if (query.sortBy === PracticeSortBy.SUBMISSION_COUNT) {
      queryBuilder.orderBy('progress.totalAttempts', sortOrder);
    } else {
      // Default to LAST_SUBMITTED_AT
      queryBuilder.orderBy('progress.lastAttemptedAt', sortOrder);
    }

    const [progressRecords, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    if (progressRecords.length === 0) {
      return new PaginatedResultDto([], { page, limit, total });
    }

    // 2. Fetch submissions for these problems with optimized selection
    const problemIds = progressRecords.map((p) => p.problemId);

    const submissions = await this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoin('submission.language', 'language')
      .select([
        'submission.id',
        'submission.status',
        'submission.runtimeMs',
        'submission.memoryKb',
        'submission.passedTestcases',
        'submission.totalTestcases',
        'submission.submittedAt',
        'submission.problemId',
        'language.id',
        'language.name',
      ])
      .where('submission.userId = :userId', { userId })
      .andWhere('submission.problemId IN (:...problemIds)', { problemIds })
      .orderBy('submission.submittedAt', 'DESC')
      .getMany();

    // 3. Group submissions by problemId
    const submissionsByProblem: Record<number, Submission[]> = {};
    submissions.forEach((s) => {
      // s.problemId is available because we selected it
      if (!submissionsByProblem[s.problemId]) {
        submissionsByProblem[s.problemId] = [];
      }
      submissionsByProblem[s.problemId].push(s);
    });

    // 4. Map to enriched DTO
    const enrichedData: UserPracticeHistoryDto[] = progressRecords.map(
      (progress) => {
        const problemSubmissions =
          submissionsByProblem[progress.problemId] || [];

        return {
          problem: {
            id: progress.problem.id,
            title: progress.problem.title,
            slug: progress.problem.slug,
            difficulty: progress.problem.difficulty,
          },
          status: progress.status,
          lastSubmittedAt: progress.lastAttemptedAt,
          lastResult: problemSubmissions[0]?.status ?? null,
          submissionCount: progress.totalAttempts,
          submissions: problemSubmissions.map((s) => ({
            id: s.id,
            status: s.status,
            executionTime: s.runtimeMs ?? 0,
            memoryUsed: s.memoryKb ?? 0,
            testcasesPassed: s.passedTestcases,
            totalTestcases: s.totalTestcases,
            submittedAt: s.submittedAt,
            problemId: s.problemId,
            language: {
              id: s.language.id,
              name: s.language.name,
            },
          })),
        };
      },
    );

    return new PaginatedResultDto(enrichedData, { page, limit, total });
  }

  /**
   * Get recent solved problems
   */
  async getRecentSolvedProblems(
    userId: number,
    limit = 15,
  ): Promise<UserProblemProgress[]> {
    return (
      this.progressRepository
        .createQueryBuilder('progress')
        .leftJoin('progress.problem', 'problem')
        .select([
          'progress.userId', // Include PK
          'progress.problemId', // Include PK
          'progress.status',
          'progress.totalAttempts',
          'progress.lastAttemptedAt',
          'progress.firstSolvedAt', // Important for "recent solved" context
          'problem.id',
          'problem.title',
          'problem.slug',
          'problem.difficulty',
        ])
        .where('progress.userId = :userId', { userId })
        .andWhere('progress.status = :status', {
          status: ProgressStatus.SOLVED,
        })
        .orderBy('progress.lastAttemptedAt', 'DESC') // Or firstSolvedAt? User asked for recent AC. Usually last solve time if re-solving, or first solve.
        // If we track firstSolvedAt, we should sort by that to show "Recent First Solves".
        // But LeetCode "Recent AC" usually shows most recent submission.
        // Let's stick to lastAttemptedAt as it's updated on every submission.
        .take(limit)
        .getMany()
    );
  }

  /**
   * Map entity to DTO (Slim)
   */
  private mapToDto(
    progress: UserProblemProgress,
  ): UserProblemProgressResponseDto {
    const dto = new UserProblemProgressResponseDto();
    this.assignBasicFields(progress, dto);
    return dto;
  }

  /**
   * Map entity to Detailed DTO
   */
  private mapToDetailDto(
    progress: UserProblemProgress,
  ): UserProblemProgressDetailResponseDto {
    const dto = new UserProblemProgressDetailResponseDto();
    this.assignBasicFields(progress, dto);

    if (progress.bestSubmission) {
      dto.bestSubmission = {
        id: progress.bestSubmission.id,
        status: progress.bestSubmission.status,
        executionTime: progress.bestSubmission.runtimeMs ?? undefined,
        memoryUsed: progress.bestSubmission.memoryKb ?? undefined,
        testcasesPassed: progress.bestSubmission.passedTestcases,
        totalTestcases: progress.bestSubmission.totalTestcases,
        submittedAt: progress.bestSubmission.submittedAt,
        problemId: progress.problemId,
        languageId: progress.bestSubmission.language?.id,
        language: progress.bestSubmission.language
          ? {
              id: progress.bestSubmission.language.id,
              name: progress.bestSubmission.language.name,
            }
          : undefined,
      };
    }

    return dto;
  }

  /**
   * Assign basic fields to DTO
   */
  private assignBasicFields(
    progress: UserProblemProgress,
    dto: UserProblemProgressResponseDto,
  ): void {
    dto.userId = progress.userId;
    dto.problemId = progress.problemId;
    dto.status = progress.status;
    dto.totalAttempts = progress.totalAttempts;
    dto.totalAccepted = progress.totalAccepted;
    dto.bestRuntimeMs = progress.bestRuntimeMs;
    dto.bestMemoryKb = progress.bestMemoryKb;
    dto.firstAttemptedAt = progress.firstAttemptedAt;
    dto.firstSolvedAt = progress.firstSolvedAt;
    dto.lastAttemptedAt = progress.lastAttemptedAt;

    if (progress.problem) {
      dto.problem = {
        id: progress.problem.id,
        title: progress.problem.title,
        slug: progress.problem.slug,
      };
    }
  }

  /**
   * Update user progress when a new submission is created
   * Note: This only tracks attempts. Acceptance is tracked in updateProgressAfterJudge()
   */
  async updateProgressOnSubmit(
    userId: number,
    problemId: number,
  ): Promise<void> {
    let progress = await this.progressRepository.findOne({
      where: { userId, problemId },
    });

    const now = new Date();

    if (!progress) {
      // Create new progress record
      progress = this.progressRepository.create({
        userId,
        problemId,
        user: { id: userId },
        problem: { id: problemId },
        status: ProgressStatus.ATTEMPTED,
        totalAttempts: 1,
        totalAccepted: 0,
        firstAttemptedAt: now,
        lastAttemptedAt: now,
      });
    } else {
      // Update existing progress - only increment attempts
      progress.totalAttempts += 1;
      progress.lastAttemptedAt = now;
    }

    await this.progressRepository.save(progress);
  }

  /**
   * Update user progress after judging is complete
   */
  async updateProgressAfterJudge(
    userId: number,
    problemId: number,
    submissionId: number,
    status: SubmissionStatus,
    runtimeMs?: number,
    memoryKb?: number,
  ): Promise<ProgressStatus | null> {
    const progress = await this.progressRepository.findOne({
      where: { userId, problemId },
    });

    if (!progress) {
      return null; // Should not happen, but handle gracefully
    }

    // Update if submission was accepted
    if (status === SubmissionStatus.ACCEPTED) {
      progress.totalAccepted += 1;

      // Update status to solved if first solve
      if (progress.status !== ProgressStatus.SOLVED) {
        progress.status = ProgressStatus.SOLVED;
        progress.firstSolvedAt = new Date();
      }

      // Update best runtime if this submission is faster
      if (
        !progress.bestRuntimeMs ||
        (runtimeMs && runtimeMs < progress.bestRuntimeMs)
      ) {
        progress.bestRuntimeMs = runtimeMs ?? null;
        progress.bestSubmission = { id: submissionId } as Submission;
      }

      // Update best memory separately if this submission uses less memory
      if (
        !progress.bestMemoryKb ||
        (memoryKb && memoryKb < progress.bestMemoryKb)
      ) {
        progress.bestMemoryKb = memoryKb ?? null;
      }
    } else {
      // Update status to attempted if not solved yet
      if (progress.status === ProgressStatus.NOT_STARTED) {
        progress.status = ProgressStatus.ATTEMPTED;
      }
    }

    await this.progressRepository.save(progress);
    return progress.status;
  }
}

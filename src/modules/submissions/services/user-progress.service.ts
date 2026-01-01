import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResultDto, PaginationQueryDto } from '../../../common';
import { Submission } from '../entities/submission.entity';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus } from '../enums';
import { SubmissionStatus } from '../enums';
import { UserPracticeHistoryDto } from '../dto/user-practice-history.dto';

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
  ): Promise<UserProblemProgress | null> {
    return this.progressRepository.findOne({
      where: { userId, problemId },
      relations: ['bestSubmission', 'problem', 'user'],
    });
  }

  /**
   * Get all problem progress for a user with pagination
   */
  async getAllUserProgress(
    userId: number,
    paginationDto: PaginationQueryDto,
    status?: ProgressStatus,
  ): Promise<PaginatedResultDto<UserPracticeHistoryDto>> {
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.take;
    const skip = paginationDto.skip;

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
      .where('progress.userId = :userId', { userId })
      .orderBy('progress.lastAttemptedAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('progress.status = :status', { status });
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
  ): Promise<void> {
    const progress = await this.progressRepository.findOne({
      where: { userId, problemId },
    });

    if (!progress) {
      return; // Should not happen, but handle gracefully
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
  }
}

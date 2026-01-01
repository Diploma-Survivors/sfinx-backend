import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResultDto, PaginationQueryDto } from '../../../common';
import { UserProblemProgressDetailResponseDto } from '../dto/user-problem-progress-detail-response.dto';
import { UserProblemProgressResponseDto } from '../dto/user-problem-progress-response.dto';
import { Submission } from '../entities/submission.entity';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus } from '../enums/progress-status.enum';
import { SubmissionStatus } from '../enums/submission-status.enum';

export interface UserProgressStats {
  userId: number;
  problemId: number;
  status: ProgressStatus;
  totalAttempts: number;
  totalAccepted: number;
  bestRuntimeMs: number | null;
  bestMemoryKb: number | null;
  firstAttemptedAt: Date;
  firstSolvedAt: Date | null;
  lastAttemptedAt: Date;
}

/**
 * Service responsible for managing user problem progress
 * Follows Single Responsibility Principle
 */
@Injectable()
export class UserProgressService {
  constructor(
    @InjectRepository(UserProblemProgress)
    private readonly progressRepository: Repository<UserProblemProgress>,
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
    paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResultDto<UserProblemProgressResponseDto>> {
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.take;
    const skip = paginationDto.skip;

    const [data, total] = await this.progressRepository.findAndCount({
      where: { userId },
      relations: ['problem'],
      order: { lastAttemptedAt: 'DESC' },
      skip,
      take: limit,
    });

    const mappedData = data.map((item) => this.mapToDto(item));

    return new PaginatedResultDto(mappedData, { page, limit, total });
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

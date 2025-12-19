import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Submission } from '../entities/submission.entity';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus } from '../enums/progress-status.enum';
import { SubmissionStatus } from '../enums/submission-status.enum';

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
  ): Promise<UserProblemProgress | null> {
    return this.progressRepository.findOne({
      where: { userId, problemId },
      relations: ['bestSubmission', 'problem', 'user'],
    });
  }

  /**
   * Get all problem progress for a user
   */
  async getAllUserProgress(userId: number): Promise<UserProblemProgress[]> {
    return this.progressRepository.find({
      where: { userId },
      relations: ['problem', 'bestSubmission'],
      order: { lastAttemptedAt: 'DESC' },
    });
  }

  /**
   * Update user progress when a new submission is created
   */
  async updateProgressOnSubmit(
    userId: number,
    problemId: number,
    submission: Submission,
  ): Promise<void> {
    let progress = await this.progressRepository.findOne({
      where: { userId, problemId },
    });

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
        lastAttemptedAt: new Date(),
      });
    } else {
      // Update existing progress
      if (submission?.status === SubmissionStatus.ACCEPTED) {
        progress.totalAccepted += 1;
      }
      progress.totalAttempts += 1;
      progress.lastAttemptedAt = new Date();
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

      // Update best submission if this one is better
      if (
        !progress.bestRuntimeMs ||
        (runtimeMs && runtimeMs < progress.bestRuntimeMs)
      ) {
        progress.bestRuntimeMs = runtimeMs ?? null;
        progress.bestMemoryKb = memoryKb ?? null;
        progress.bestSubmission = { id: submissionId } as Submission;
      }
    } else {
      // Update status to attempted-unsolved if not solved yet
      if (progress.status === ProgressStatus.ATTEMPTED) {
        progress.status = ProgressStatus.ATTEMPTED_UNSOLVED;
      }
    }

    await this.progressRepository.save(progress);
  }
}

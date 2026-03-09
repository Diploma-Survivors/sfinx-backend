import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaderboardEntryResponseDto } from '../dto/study-plan-response.dto';
import { StudyPlan } from '../entities/study-plan.entity';
import { StudyPlanItem } from '../entities/study-plan-item.entity';
import { StudyPlanEnrollment } from '../entities/study-plan-enrollment.entity';

@Injectable()
export class StudyPlanLeaderboardService {
  constructor(
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(StudyPlanItem)
    private readonly itemRepository: Repository<StudyPlanItem>,
    @InjectRepository(StudyPlanEnrollment)
    private readonly enrollmentRepository: Repository<StudyPlanEnrollment>,
  ) {}

  async getLeaderboard(
    planId: number,
    limit: number = 20,
  ): Promise<LeaderboardEntryResponseDto[]> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${planId} not found`);
    }

    const enrollments = await this.enrollmentRepository.find({
      where: { studyPlanId: planId },
      relations: ['user'],
      order: { solvedCount: 'DESC', enrolledAt: 'ASC' },
      take: limit,
    });

    const totalProblems = await this.itemRepository.count({
      where: { studyPlanId: planId },
    });

    return enrollments.map(
      (e, index): LeaderboardEntryResponseDto => ({
        rank: index + 1,
        userId: e.userId,
        username: e.user?.username ?? null,
        fullName: e.user?.fullName ?? null,
        avatarKey: e.user?.avatarKey ?? null,
        solvedCount: e.solvedCount,
        totalProblems,
        progressPercentage:
          totalProblems > 0
            ? Math.round((e.solvedCount / totalProblems) * 100)
            : 0,
        status: e.status,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
      }),
    );
  }
}

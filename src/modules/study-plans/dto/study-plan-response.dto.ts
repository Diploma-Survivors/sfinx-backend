import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Problem } from 'src/modules/problems/entities/problem.entity';
import { Tag } from 'src/modules/problems/entities/tag.entity';
import { Topic } from 'src/modules/problems/entities/topic.entity';
import { EnrollmentStatus } from '../enums/enrollment-status.enum';
import { StudyPlanDifficulty } from '../enums/study-plan-difficulty.enum';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';
import { StudyPlanTranslationDto } from './study-plan-translation.dto';

// ─── Lightweight base (shared by all public endpoints) ────────────────

export class StudyPlanCardResponseDto {
  @ApiProperty({ description: 'Plan ID' })
  id: number;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiProperty({ description: 'Translated plan name' })
  name: string;

  @ApiProperty({ description: 'Difficulty level', enum: StudyPlanDifficulty })
  difficulty: StudyPlanDifficulty;

  @ApiPropertyOptional({ description: 'Cover image URL via CloudFront' })
  coverImageUrl: string | null;

  @ApiProperty({ description: 'Estimated days to complete' })
  estimatedDays: number;

  @ApiProperty({ description: 'Whether plan requires premium' })
  isPremium: boolean;

  @ApiProperty({ description: 'Total number of problems in the plan' })
  totalProblems: number;
}

// ─── Public list item ─────────────────────────────────────────────────

export class StudyPlanListItemResponseDto extends StudyPlanCardResponseDto {
  @ApiProperty({ description: 'Whether current user is enrolled' })
  isEnrolled: boolean;

  @ApiProperty({ description: 'Number of problems solved by current user' })
  solvedCount: number;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: EnrollmentStatus,
  })
  enrollmentStatus: EnrollmentStatus | null;
}

// ─── Public detail ────────────────────────────────────────────────────

export class StudyPlanDetailResponseDto extends StudyPlanCardResponseDto {
  @ApiPropertyOptional({ description: 'Translated plan description' })
  description: string | null;

  @ApiProperty({ description: 'Number of enrolled users' })
  enrollmentCount: number;

  @ApiProperty({ description: 'Associated topics', type: () => [Topic] })
  topics: Topic[];

  @ApiProperty({ description: 'Associated tags', type: () => [Tag] })
  tags: Tag[];

  @ApiProperty({ description: 'Whether current user is enrolled' })
  isEnrolled: boolean;

  @ApiProperty({ description: 'Number of problems solved by current user' })
  solvedCount: number;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: EnrollmentStatus,
  })
  enrollmentStatus: EnrollmentStatus | null;

  @ApiProperty({
    description: 'Problems grouped by day',
    type: () => [StudyPlanDayResponseDto],
  })
  days: StudyPlanDayResponseDto[];
}

// ─── Items & Days ─────────────────────────────────────────────────────

export class StudyPlanItemResponseDto {
  @ApiProperty({ description: 'Item ID' })
  id: number;

  @ApiProperty({ description: 'Day number in the plan' })
  dayNumber: number;

  @ApiProperty({ description: 'Display order within the day' })
  orderIndex: number;

  @ApiPropertyOptional({ description: 'Admin note for this item' })
  note: string | null;

  @ApiProperty({ description: 'Problem details', type: () => Problem })
  problem: Problem;

  @ApiPropertyOptional({
    description: 'User progress status (e.g., solved, attempted)',
  })
  progressStatus: string | null;
}

export class StudyPlanDayResponseDto {
  @ApiProperty({ description: 'Day number' })
  dayNumber: number;

  @ApiProperty({
    description: 'Items for this day',
    type: [StudyPlanItemResponseDto],
  })
  items: StudyPlanItemResponseDto[];
}

// ─── Enrolled plans list ──────────────────────────────────────────────

export class EnrolledPlanResponseDto extends StudyPlanCardResponseDto {
  @ApiProperty({ description: 'Enrollment status', enum: EnrollmentStatus })
  enrollmentStatus: EnrollmentStatus;

  @ApiProperty({ description: 'Current day the user is on' })
  currentDay: number;

  @ApiProperty({ description: 'Number of problems solved' })
  solvedCount: number;

  @ApiPropertyOptional({ description: 'Last activity timestamp' })
  lastActivityAt: Date | null;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt: Date | null;

  @ApiProperty({ description: 'Enrollment timestamp' })
  enrolledAt: Date;
}

// ─── Progress detail ──────────────────────────────────────────────────

export class StudyPlanProgressResponseDto extends StudyPlanCardResponseDto {
  @ApiProperty({ description: 'Enrollment status', enum: EnrollmentStatus })
  enrollmentStatus: EnrollmentStatus;

  @ApiProperty({ description: 'Current day the user is on' })
  currentDay: number;

  @ApiProperty({ description: 'Number of problems solved' })
  solvedCount: number;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt: Date | null;

  @ApiProperty({ description: 'Enrollment timestamp' })
  enrolledAt: Date;

  @ApiProperty({
    description: 'Problems grouped by day',
    type: () => [StudyPlanDayResponseDto],
  })
  days: StudyPlanDayResponseDto[];
}

// ─── Admin item (raw note, not language-resolved) ─────────────────────

export class AdminStudyPlanItemResponseDto {
  @ApiProperty({ description: 'Item ID' })
  id: number;

  @ApiProperty({ description: 'Day number in the plan' })
  dayNumber: number;

  @ApiProperty({ description: 'Display order within the day' })
  orderIndex: number;

  @ApiPropertyOptional({
    description: 'Translatable note (raw JSONB, all languages)',
    example: { en: 'Classic DP', vi: 'Quy hoạch động kinh điển' },
  })
  note: Record<string, string> | null;

  @ApiProperty({ description: 'Problem details', type: () => Problem })
  problem: Problem;
}

export class AdminStudyPlanDayResponseDto {
  @ApiProperty({ description: 'Day number' })
  dayNumber: number;

  @ApiProperty({
    description: 'Items for this day',
    type: [AdminStudyPlanItemResponseDto],
  })
  items: AdminStudyPlanItemResponseDto[];
}

// ─── Admin list ───────────────────────────────────────────────────────

export class AdminStudyPlanResponseDto extends StudyPlanCardResponseDto {
  @ApiPropertyOptional({ description: 'Translated plan description' })
  description: string | null;

  @ApiProperty({ description: 'Plan status', enum: StudyPlanStatus })
  status: StudyPlanStatus;

  @ApiProperty({ description: 'Number of enrolled users' })
  enrollmentCount: number;

  @ApiProperty({ description: 'IDs of similar study plans', type: [Number] })
  similarPlanIds: number[];

  @ApiProperty({ description: 'Associated topics', type: () => [Topic] })
  topics: Topic[];

  @ApiProperty({ description: 'Associated tags', type: () => [Tag] })
  tags: Tag[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

// ─── Admin detail (with items grouped by day) ─────────────────────────

export class AdminStudyPlanDetailResponseDto extends AdminStudyPlanResponseDto {
  @ApiProperty({
    description: 'All translations (raw, all languages)',
    type: 'array',
    example: [
      { languageCode: 'en', name: 'DP Mastery', description: 'Master DP' },
    ],
  })
  translations: StudyPlanTranslationDto[];

  @ApiProperty({
    description: 'Items grouped by day (raw notes, all languages)',
    type: () => [AdminStudyPlanDayResponseDto],
  })
  days: AdminStudyPlanDayResponseDto[];
}

// ─── Leaderboard ──────────────────────────────────────────────────────

export class LeaderboardEntryResponseDto {
  @ApiProperty({ description: 'Rank position' })
  rank: number;

  @ApiProperty({ description: 'User ID' })
  userId: number;

  @ApiPropertyOptional({ description: 'Username' })
  username: string | null;

  @ApiPropertyOptional({ description: 'Full name' })
  fullName: string | null;

  @ApiPropertyOptional({ description: 'Avatar S3 key' })
  avatarKey: string | null;

  @ApiProperty({ description: 'Number of problems solved' })
  solvedCount: number;

  @ApiProperty({ description: 'Total problems in the plan' })
  totalProblems: number;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ description: 'Enrollment status', enum: EnrollmentStatus })
  status: EnrollmentStatus;

  @ApiProperty({ description: 'Enrollment timestamp' })
  enrolledAt: Date;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt: Date | null;
}

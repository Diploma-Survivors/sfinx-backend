import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiPaginatedResponse, GetUser, Language } from 'src/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/auth/guards/optional-jwt-auth.guard';
import { User } from 'src/modules/auth/entities/user.entity';
import { FilterStudyPlanDto } from '../dto/filter-study-plan.dto';
import {
  EnrolledPlanResponseDto,
  LeaderboardEntryResponseDto,
  StudyPlanCardResponseDto,
  StudyPlanDetailResponseDto,
  StudyPlanListItemResponseDto,
  StudyPlanProgressResponseDto,
} from '../dto/study-plan-response.dto';
import { StudyPlanQueryService } from '../services/study-plan-query.service';
import { StudyPlanEnrollmentService } from '../services/study-plan-enrollment.service';
import { StudyPlanLeaderboardService } from '../services/study-plan-leaderboard.service';

@ApiTags('Study Plans')
@Controller('study-plans')
export class StudyPlanController {
  constructor(
    private readonly queryService: StudyPlanQueryService,
    private readonly enrollmentService: StudyPlanEnrollmentService,
    private readonly leaderboardService: StudyPlanLeaderboardService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List published study plans' })
  @ApiPaginatedResponse(StudyPlanListItemResponseDto)
  findAll(
    @Query() query: FilterStudyPlanDto,
    @Language() lang: string,
    @GetUser('id') userId?: number,
  ) {
    return this.queryService.findAll(query, lang, userId);
  }

  @Get('enrolled/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my enrolled study plans' })
  @ApiResponse({ status: 200, type: [EnrolledPlanResponseDto] })
  getEnrolledPlans(@GetUser('id') userId: number, @Language() lang: string) {
    return this.enrollmentService.getEnrolledPlans(userId, lang);
  }

  @Get(':idOrSlug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get study plan detail by ID or slug' })
  @ApiResponse({ status: 200, type: StudyPlanDetailResponseDto })
  @ApiResponse({ status: 403, description: 'Premium subscription required' })
  findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Language() lang: string,
    @GetUser() user?: User,
  ) {
    return this.queryService.findByIdOrSlug(idOrSlug, lang, user);
  }

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enroll in a study plan' })
  @ApiResponse({ status: 201, description: 'Enrolled successfully' })
  enroll(@Param('id', ParseIntPipe) planId: number, @GetUser() user: User) {
    return this.enrollmentService.enroll(planId, user);
  }

  @Delete(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unenroll from a study plan' })
  @ApiResponse({ status: 200, description: 'Unenrolled successfully' })
  unenroll(
    @Param('id', ParseIntPipe) planId: number,
    @GetUser('id') userId: number,
  ) {
    return this.enrollmentService.unenroll(planId, userId);
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed progress for an enrolled plan' })
  @ApiResponse({ status: 200, type: StudyPlanProgressResponseDto })
  getPlanProgress(
    @Param('id', ParseIntPipe) planId: number,
    @GetUser('id') userId: number,
    @Language() lang: string,
  ) {
    return this.enrollmentService.getPlanProgress(planId, userId, lang);
  }

  @Get(':id/similar')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get similar study plans' })
  @ApiResponse({ status: 200, type: [StudyPlanCardResponseDto] })
  getSimilarPlans(
    @Param('id', ParseIntPipe) planId: number,
    @Language() lang: string,
  ) {
    return this.queryService.getSimilarPlans(planId, lang);
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a study plan' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [LeaderboardEntryResponseDto] })
  getLeaderboard(
    @Param('id', ParseIntPipe) planId: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.leaderboardService.getLeaderboard(planId, limit);
  }
}

import { Controller, Get, Param, Query, Sse, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import {
  ApiPaginatedResponse,
  GetUser,
  PaginatedResultDto,
  PaginationQueryDto,
} from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LeaderboardEntryDto } from '../dto/leaderboard-entry.dto';
import { ContestLeaderboardService } from '../services/contest-leaderboard.service';
import { ContestSseService } from '../services/contest-sse.service';

@ApiTags('Contest Leaderboard')
@Controller('contests/:contestId/leaderboard')
export class ContestLeaderboardController {
  constructor(
    private readonly leaderboardService: ContestLeaderboardService,
    private readonly sseService: ContestSseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get contest leaderboard' })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiPaginatedResponse(
    LeaderboardEntryDto,
    'Leaderboard retrieved successfully',
  )
  async getLeaderboard(
    @Param('contestId') contestId: string,
    @Query() paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResultDto<LeaderboardEntryDto>> {
    return this.leaderboardService.getLeaderboard(
      +contestId,
      paginationDto.page ?? 1,
      paginationDto.limit ?? 50,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my standing in the leaderboard' })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Standing retrieved',
    type: LeaderboardEntryDto,
  })
  @ApiResponse({ status: 404, description: 'Not registered for contest' })
  async getMyStanding(
    @Param('contestId') contestId: string,
    @GetUser() user: User,
  ): Promise<LeaderboardEntryDto | null> {
    return this.leaderboardService.getParticipantStanding(+contestId, user.id);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for real-time leaderboard updates' })
  @ApiParam({ name: 'contestId', description: 'Contest ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established',
    content: {
      'text/event-stream': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            type: {
              type: 'string',
              enum: ['leaderboard_update', 'ping', 'end'],
            },
          },
        },
      },
    },
  })
  getLeaderboardStream(
    @Param('contestId') contestId: string,
  ): Observable<MessageEvent> {
    return this.sseService.getLeaderboardStream(+contestId);
  }
}

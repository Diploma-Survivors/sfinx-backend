
import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from '../auth/entities/user.entity';
import { LiveKitService } from './livekit.service';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { AiInterviewService } from '../ai-interviews/services/ai-interview.service';

@ApiTags('LiveKit')
@ApiBearerAuth('JWT-auth')
@Controller('livekit')
@UseGuards(JwtAuthGuard)
export class LiveKitController {
  constructor(
    private readonly livekitService: LiveKitService,
    private readonly interviewService: AiInterviewService,
  ) {}

  @Post('token')
  @ApiOperation({
    summary: 'Generate LiveKit token for voice interview',
    description:
      'Returns an access token that allows the user to join a voice interview room',
  })
  async generateToken(@GetUser() user: User, @Body() dto: GenerateTokenDto) {
    const interview = await this.interviewService.getInterview(
      dto.interviewId,
      user.id,
    );

    const roomName = `interview-${dto.interviewId}`;

    const token = await this.livekitService.generateToken({
      roomName,
      participantIdentity: `user-${user.id}`,
      participantName: dto.displayName || user.username,
      metadata: {
        interviewId: dto.interviewId,
        problemId: interview.problemId,
        userId: user.id,
      },
    });

    return token;
  }

  
  @Get('room/:interviewId/status')
  @ApiOperation({ summary: 'Get voice room status' })
  async getRoomStatus(
    @GetUser('id') userId: number,
    @Param('interviewId') interviewId: string,
  ) {
    await this.interviewService.getInterview(interviewId, userId);

    const roomName = `interview-${interviewId}`;
    try {
      const participants =
        await this.livekitService.listParticipants(roomName);
      return {
        active: true,
        participants: participants.length,
      };
    } catch {
      return {
        active: false,
        participants: 0,
      };
    }
  }
}

import { Controller, Post, Body, Get, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AiInterviewService } from '../services/ai-interview.service';
import { AiChatService } from '../services/ai-chat.service';
import { StartInterviewDto } from '../dto/start-interview.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { CodeSnapshotDto } from '../dto/code-snapshot.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from '../../auth/entities/user.entity';

@ApiTags('AI Interviews')
@ApiBearerAuth('JWT-auth')
@Controller('ai-interviews')
@UseGuards(JwtAuthGuard)
export class AiInterviewController {
  constructor(
    private readonly interviewService: AiInterviewService,
    private readonly chatService: AiChatService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get interview history for current user' })
  getInterviewHistory(@GetUser('id') userId: number) {
    return this.interviewService.getInterviewHistory(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Start a new AI interview' })
  startInterview(@GetUser() user: User, @Body() dto: StartInterviewDto) {
    return this.interviewService.startInterview(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get interview details' })
  getInterview(@GetUser('id') userId: number, @Param('id') id: string) {
    return this.interviewService.getInterview(id, userId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message to AI (chat or code review)' })
  sendMessage(
    @GetUser('id') userId: number,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, userId, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get chat history' })
  getHistory(@GetUser('id') userId: number, @Param('id') id: string) {
    return this.chatService.getHistory(id, userId);
  }

  @Post(':id/code-snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Store code snapshot for AI context' })
  storeCodeSnapshot(
    @GetUser('id') userId: number,
    @Param('id') id: string,
    @Body() dto: CodeSnapshotDto,
  ) {
    return this.interviewService.storeCodeSnapshot(id, userId, dto);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End interview and get evaluation' })
  endInterview(@GetUser('id') userId: number, @Param('id') id: string) {
    return this.interviewService.endInterview(id, userId);
  }
}

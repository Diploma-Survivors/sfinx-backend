import {
  Controller,
  Get,
  Query,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common';
import { User } from '../auth/entities/user.entity';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @Get()
  async findAll(
    @GetUser() user: User,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    const [notifications, total] =
      await this.notificationsService.findAllForUser(
        user.id,
        skip ? Number(skip) : 0,
        take ? Number(take) : 20,
      );

    return {
      data: notifications,
      total,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
    };
  }

  @ApiOperation({ summary: 'Get unread notification count' })
  @Get('unread-count')
  async getUnreadCount(@GetUser() user: User) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  async markAllAsRead(@GetUser() user: User) {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }

  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @GetUser() user: User) {
    const notification = await this.notificationsService.markAsRead(
      id,
      user.id,
    );
    return { success: true, notification };
  }
}

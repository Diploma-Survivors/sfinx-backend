import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create(
      createNotificationDto,
    );
    const savedNotification =
      await this.notificationRepository.save(notification);

    // Emit via WebSocket
    this.notificationsGateway.sendNotification(
      createNotificationDto.recipientId,
      savedNotification,
    );

    return savedNotification;
  }

  async findAllForUser(
    userId: number,
    skip: number = 0,
    take: number = 20,
  ): Promise<[Notification[], number]> {
    return this.notificationRepository.findAndCount({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update(
      { recipientId: userId, isRead: false },
      { isRead: true },
    );
  }
}

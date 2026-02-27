import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationTranslation } from './entities/notification-translation.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTranslation)
    private readonly translationRepository: Repository<NotificationTranslation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const { translations, ...notificationData } = createNotificationDto;

    const notification = this.notificationRepository.create({
      ...notificationData,
      translations: translations.map((t) =>
        this.translationRepository.create(t),
      ),
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    // Resolve the recipient's preferred language for WebSocket delivery
    const recipient = await this.userRepository.findOne({
      where: { id: createNotificationDto.recipientId },
      select: ['id', 'preferredLanguage'],
    });
    const lang = recipient?.preferredLanguage ?? 'en';
    const resolved = this.resolveTranslation(savedNotification, lang);

    this.notificationsGateway.sendNotification(
      createNotificationDto.recipientId,
      resolved,
    );

    return savedNotification;
  }

  async findAllForUser(
    userId: number,
    skip: number = 0,
    take: number = 20,
    lang: string = 'en',
  ): Promise<[Notification[], number]> {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { recipientId: userId },
        relations: ['translations'],
        order: { createdAt: 'DESC' },
        skip,
        take,
      });

    return [notifications.map((n) => this.resolveTranslation(n, lang)), total];
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipientId: userId },
      relations: ['translations'],
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

  /**
   * Resolve the correct title/content for a notification based on the
   * requested language. Falls back to 'en' if the requested language is unavailable.
   */
  private resolveTranslation(
    notification: Notification,
    lang: string,
  ): Notification & { title: string; content: string } {
    const translations = notification.translations ?? [];

    const match =
      translations.find((t) => t.languageCode === lang) ??
      translations.find((t) => t.languageCode === 'en');

    return {
      ...notification,
      title: match?.title ?? '',
      content: match?.content ?? '',
    };
  }
}

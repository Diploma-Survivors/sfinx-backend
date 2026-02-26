import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_translations')
export class NotificationTranslation {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Notification ID this translation belongs to' })
  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ApiProperty({ description: 'Language code (e.g. en, vi)' })
  @Column({ name: 'language_code', length: 10 })
  languageCode: string;

  @ApiProperty({ description: 'Translated title' })
  @Column({ length: 255 })
  title: string;

  @ApiProperty({ description: 'Translated content/body' })
  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => Notification, (n) => n.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;
}

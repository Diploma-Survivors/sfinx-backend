import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationTranslation } from './notification-translation.entity';

@Entity('notifications')
export class Notification {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Recipient of the notification',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @Column({ name: 'recipient_id' })
  recipientId: number;

  @ApiProperty({
    description: 'Sender of the event, if applicable',
    type: () => User,
    required: false,
  })
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User | null;

  @Column({ type: 'int', name: 'sender_id', nullable: true })
  senderId: number | null;

  @ApiProperty({ enum: NotificationType, example: NotificationType.SYSTEM })
  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @ApiProperty({
    description: 'Target URL to redirect when clicked',
    required: false,
  })
  @Column({ type: 'varchar', nullable: true, length: 255 })
  link: string | null;

  @ApiProperty({ description: 'Whether the notification has been read' })
  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @ApiProperty({
    description: 'Additional metadata for the notification context',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Translations for this notification',
    type: () => [NotificationTranslation],
  })
  @OneToMany(() => NotificationTranslation, (t) => t.notification, {
    cascade: true,
  })
  translations: NotificationTranslation[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

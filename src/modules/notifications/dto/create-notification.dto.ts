import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID of the recipient', example: 1 })
  @IsInt()
  @IsNotEmpty()
  recipientId: number;

  @ApiPropertyOptional({
    description: 'ID of the sender, if applicable',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  senderId?: number;

  @ApiProperty({ enum: NotificationType, example: NotificationType.SYSTEM })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiProperty({ example: 'New Comment' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Someone replied to your comment.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: '/problems/1' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: any;
}

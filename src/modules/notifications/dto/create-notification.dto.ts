import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationTranslationDto } from './notification-translation.dto';

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

  @ApiProperty({
    description:
      'Translations for this notification. Must include at least one entry. EN is used as the fallback language.',
    type: () => [NotificationTranslationDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotificationTranslationDto)
  translations: NotificationTranslationDto[];

  @ApiPropertyOptional({ example: '/problems/1' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Language } from '../../auth/enums/language.enum';

export class NotificationTranslationDto {
  @ApiProperty({
    description: 'Language code',
    enum: Language,
    example: Language.EN,
  })
  @IsEnum(Language)
  languageCode: Language;

  @ApiProperty({ description: 'Translated title', example: 'New comment' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Translated content/body',
    example: 'Someone replied to your comment.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

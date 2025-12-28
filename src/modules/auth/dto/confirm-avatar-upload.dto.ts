import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ConfirmAvatarUploadDto {
  @ApiProperty({
    description: 'S3 key of the uploaded avatar',
    example: 'avatars/123/1735500000.jpg',
    pattern: '^avatars/\\d+/\\d+\\.(jpg|jpeg|png|webp|gif)$',
  })
  @IsString()
  @Matches(/^avatars\/\d+\/\d+\.(jpg|jpeg|png|webp|gif)$/i, {
    message:
      'Invalid S3 key format. Expected: avatars/{userId}/{timestamp}.{ext}',
  })
  key: string;
}

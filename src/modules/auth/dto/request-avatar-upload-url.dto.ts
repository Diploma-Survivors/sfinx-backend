import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches } from 'class-validator';

enum AllowedImageType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
}

export class RequestAvatarUploadUrlDto {
  @ApiProperty({
    description: 'Original file name',
    example: 'avatar.jpg',
    pattern: '^[a-zA-Z0-9_.-]+\\.(jpg|jpeg|png|webp|gif)$',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp|gif)$/i, {
    message:
      'File name must have a valid image extension (jpg, jpeg, png, webp, gif)',
  })
  fileName: string;

  @ApiProperty({
    description: 'Content type of the file',
    enum: AllowedImageType,
    example: AllowedImageType.JPEG,
  })
  @IsEnum(AllowedImageType, {
    message:
      'Content type must be one of: image/jpeg, image/png, image/webp, image/gif',
  })
  contentType: AllowedImageType;
}

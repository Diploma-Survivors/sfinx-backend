import { ApiProperty } from '@nestjs/swagger';

export class AvatarUploadUrlResponseDto {
  @ApiProperty({
    description: 'Presigned URL for uploading avatar to S3',
    example:
      'https://your-bucket.s3.amazonaws.com/avatars/123/1735500000.jpg?X-Amz-...',
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'S3 key where the file will be stored',
    example: 'avatars/123/1735500000.jpg',
  })
  key: string;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Maximum file size allowed in bytes',
    example: 5242880,
  })
  maxSizeBytes: number;
}

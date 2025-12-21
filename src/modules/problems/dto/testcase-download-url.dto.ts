import { ApiProperty } from '@nestjs/swagger';

export class TestcaseDownloadUrlDto {
  @ApiProperty({
    description: 'Presigned URL for direct download from S3',
    example: 'https://s3.amazonaws.com/bucket/testcases/problem-1.zip?...',
  })
  url: string;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}

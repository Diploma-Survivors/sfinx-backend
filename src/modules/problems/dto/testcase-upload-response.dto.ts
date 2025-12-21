import { ApiProperty } from '@nestjs/swagger';

export class TestcaseUploadResponseDto {
  @ApiProperty({
    description: 'S3 object key for the uploaded testcase file',
    example: 'testcases/problem-123/testcases.zip',
  })
  key: string;

  @ApiProperty({
    description: 'Number of testcases found in the uploaded file',
    example: 10,
  })
  testcaseCount: number;
}

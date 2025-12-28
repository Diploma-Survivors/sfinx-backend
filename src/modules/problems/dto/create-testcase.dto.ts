import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional } from 'class-validator';
import { TESTCASE_FILE_FIELD_NAME } from 'src/common';

export class UploadTestcaseDto {
  @ApiProperty({ description: 'Problem ID', type: Number })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  problemId: number;

  @ApiProperty({
    description: 'Testcase file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  [TESTCASE_FILE_FIELD_NAME]?: Express.Multer.File;
}

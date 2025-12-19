import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateTestcaseDto {
  @ApiProperty({
    description: 'Input for the testcase',
    required: true,
  })
  @IsString()
  input: string;

  @ApiProperty({
    description: 'Expected output for the testcase',
    required: true,
  })
  @IsString()
  output: string;
}

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Problem ID', type: Number })
  @IsInt()
  @IsNotEmpty()
  problemId: number;

  @ApiProperty({ description: 'Programming language ID', type: Number })
  @IsInt()
  @IsNotEmpty()
  languageId: number;

  @ApiProperty({ description: 'Source code' })
  @IsString()
  @IsNotEmpty()
  sourceCode: string;

  @ApiProperty({
    description: 'Test cases to try running code',
    type: [CreateTestcaseDto],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @Type(() => CreateTestcaseDto)
  @IsArray()
  @ValidateNested({ each: true })
  testCases?: CreateTestcaseDto[];
}

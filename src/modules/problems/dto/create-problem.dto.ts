import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  JsonTransformToInstance,
  JsonTransformToObject,
  TESTCASE_FILE_FIELD_NAME,
} from 'src/common';

import { ToBoolean } from '../../../common/decorators/transform.decorators';
import { ProblemDifficulty } from '../enums/problem-difficulty.enum';

export class SampleTestcaseDto {
  @ApiProperty({ description: 'Input', example: '1 2 3' })
  @IsString()
  input: string;

  @ApiProperty({ description: 'Expected output', example: '6' })
  @IsString()
  expectedOutput: string;

  @ApiPropertyOptional({ description: 'Explanation', example: 'Explanation' })
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class CreateProblemHintDto {
  @ApiProperty({ description: 'Hint order', example: 1 })
  @IsInt()
  @IsNotEmpty()
  order: number;

  @ApiProperty({
    description: 'Hint content',
    example: 'Think about using a hash map',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateProblemDto {
  @ApiProperty({ description: 'Problem title', example: 'Two Sum' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Problem description in markdown' })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description: string;

  @ApiPropertyOptional({ description: 'Input constraints' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  constraints?: string;

  @ApiProperty({
    description: 'Problem difficulty',
    enum: ProblemDifficulty,
    example: ProblemDifficulty.MEDIUM,
  })
  @IsEnum(ProblemDifficulty)
  difficulty: ProblemDifficulty;

  @ApiPropertyOptional({
    description: 'Whether problem requires premium',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({
    description: 'Whether problem is active',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the problem is a draft. Can only be set to false (publish); once published cannot revert to draft.',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isDraft?: boolean;

  @ApiProperty({
    description: 'Testcase file',
    format: 'binary',
    type: 'string',
  })
  [TESTCASE_FILE_FIELD_NAME]?: Express.Multer.File;

  @ApiPropertyOptional({
    description: 'Time limit in milliseconds for code execution',
    example: 2000,
    default: 2000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  timeLimitMs?: number;

  @ApiPropertyOptional({
    description: 'Memory limit in kilobytes for code execution',
    example: 256000,
    default: 256000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  memoryLimitKb?: number;

  @ApiPropertyOptional({
    description: 'Sample testcases',
    type: () => [SampleTestcaseDto],
  })
  @IsOptional()
  @JsonTransformToInstance(SampleTestcaseDto)
  @IsArray()
  @ValidateNested({ each: true })
  sampleTestcases?: SampleTestcaseDto[];

  @ApiPropertyOptional({
    description: 'Hints array',
    type: () => [CreateProblemHintDto],
    example: [{ order: 1, content: 'Think about using a hash map' }],
  })
  @IsOptional()
  @JsonTransformToInstance(CreateProblemHintDto)
  @IsArray()
  @ValidateNested({ each: true })
  hints?: CreateProblemHintDto[];

  @ApiPropertyOptional({ description: 'Official solution content' })
  @IsOptional()
  @IsString()
  officialSolutionContent?: string;

  @ApiPropertyOptional({ description: 'Similar problem IDs' })
  @IsOptional()
  @JsonTransformToObject('similarProblems')
  @IsArray()
  @IsInt({ each: true })
  similarProblems?: number[];

  @ApiProperty({ description: 'Topic IDs' })
  @JsonTransformToObject('topicIds')
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  topicIds: number[];

  @ApiProperty({ description: 'Tag IDs' })
  @JsonTransformToObject('tagIds')
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  tagIds: number[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TESTCASE_FILE_FIELD_NAME } from 'src/common';
import { ProblemHint } from '../entities/problem.entity';
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

export class CreateProblemDto {
  @ApiProperty({ description: 'Problem title', example: 'Two Sum' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Problem description in markdown' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Input constraints' })
  @IsOptional()
  @IsString()
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
  @Type(() => Boolean)
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ description: 'Whether problem is published' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

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
  timeLimitMs?: number;

  @ApiPropertyOptional({
    description: 'Memory limit in kilobytes for code execution',
    example: 256000,
    default: 256000,
  })
  @IsOptional()
  @Type(() => Number)
  memoryLimitKb?: number;

  @ApiPropertyOptional({
    description: 'Sample testcases',
    type: () => [SampleTestcaseDto],
  })
  @IsOptional()
  @Type(() => SampleTestcaseDto)
  @IsArray()
  @ValidateNested({ each: true })
  sampleTestcases?: SampleTestcaseDto[];

  @ApiPropertyOptional({
    description: 'Hints array',
    type: () => [ProblemHint],
    example: [{ order: 1, content: 'Think about using a hash map' }],
  })
  @IsOptional()
  @Type(() => ProblemHint)
  @IsArray()
  @ValidateNested({ each: true })
  hints?: ProblemHint[];

  @ApiPropertyOptional({ description: 'Official solution content' })
  @IsOptional()
  @IsString()
  officialSolutionContent?: string;

  @ApiPropertyOptional({ description: 'Similar problem IDs' })
  @IsOptional()
  @Type(() => Number)
  @IsArray()
  similarProblems?: number[];

  @ApiProperty({ description: 'Topic IDs' })
  @Type(() => Number)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  topicIds: number[];

  @ApiProperty({ description: 'Tag IDs' })
  @Type(() => Number)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  tagIds: number[];
}

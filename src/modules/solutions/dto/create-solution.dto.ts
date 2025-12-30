import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSolutionDto {
  @ApiProperty({ description: 'Problem ID associated with the solution' })
  @IsNotEmpty()
  @IsInt()
  problemId: number;

  @ApiProperty({ description: 'Solution title' })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ description: 'Solution content in Markdown' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'List of Programming Language IDs used' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  languageIds?: number[];

  @ApiPropertyOptional({ description: 'List of Tag IDs' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[];
}

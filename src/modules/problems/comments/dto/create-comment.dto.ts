import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CommentType } from '../enums';

export class CreateCommentDto {
  problemId: number;

  @ApiProperty({
    description: 'Comment content in markdown format',
    example: '**Great problem!** I used two pointers to solve this.',
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiProperty({
    description: 'Comment type for categorization',
    enum: CommentType,
    example: CommentType.FEEDBACK,
    default: CommentType.FEEDBACK,
  })
  @IsEnum(CommentType)
  type: CommentType;

  @ApiPropertyOptional({
    description: 'Parent comment ID for nested replies',
    example: 42,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  parentId?: number;
}

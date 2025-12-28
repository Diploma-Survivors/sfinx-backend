import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CommentType } from '../enums';

export class UpdateCommentDto {
  @ApiPropertyOptional({
    description: 'Updated comment content in markdown format',
    example: '**Great problem!** I used two pointers to solve this.',
    minLength: 1,
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated comment type',
    enum: CommentType,
    example: CommentType.TIP,
  })
  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;
}

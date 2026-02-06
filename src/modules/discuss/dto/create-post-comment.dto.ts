import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { BaseCreateCommentDto } from '../../comments-base/dto/base-create-comment.dto';

export class CreatePostCommentDto extends BaseCreateCommentDto {
  @ApiProperty({ example: 'This is a comment' })
  @IsString()
  @IsNotEmpty()
  declare content: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  declare parentId?: number;
}

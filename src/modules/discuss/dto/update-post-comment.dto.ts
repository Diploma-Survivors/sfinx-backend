import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { BaseUpdateCommentDto } from '../../comments-base/dto/base-update-comment.dto';

export class UpdatePostCommentDto extends BaseUpdateCommentDto {
  @ApiProperty({ example: 'This is an updated comment' })
  @IsString()
  @IsNotEmpty()
  declare content: string;
}

import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoteType } from '../../comments-base/enums';

export class VotePostCommentDto {
  @ApiProperty({ enum: VoteType })
  @IsEnum(VoteType)
  @IsNotEmpty()
  voteType: VoteType;
}

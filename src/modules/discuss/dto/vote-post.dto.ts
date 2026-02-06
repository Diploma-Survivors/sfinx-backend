import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoteType } from '../../comments-base/enums';

export class VotePostDto {
  @ApiProperty({
    enum: VoteType,
    description: 'Vote type: 1 for UPVOTE, -1 for DOWNVOTE',
  })
  @IsEnum(VoteType)
  @IsNotEmpty()
  voteType: VoteType;
}

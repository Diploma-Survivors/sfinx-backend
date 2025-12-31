import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsIn } from 'class-validator';
import { VoteType } from '../enums/vote-type.enum';

export class VoteCommentDto {
  @ApiProperty({
    description: 'Vote type: 1 for upvote, -1 for downvote',
    enum: [VoteType.UPVOTE, VoteType.DOWNVOTE],
    example: VoteType.UPVOTE,
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([VoteType.UPVOTE, VoteType.DOWNVOTE])
  voteType: number;
}

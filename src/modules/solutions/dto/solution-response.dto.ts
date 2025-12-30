import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Tag } from '../../problems/entities/tag.entity';
import { User } from '../../auth/entities/user.entity';

export class SolutionResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  problemId: number;

  @ApiProperty()
  @Expose()
  title: string;

  @ApiProperty()
  @Expose()
  content: string;

  @ApiProperty()
  @Expose()
  authorId: number;

  @ApiProperty({ type: () => User })
  @Expose()
  @Type(() => User)
  author: User;

  @ApiProperty()
  @Expose()
  upvoteCount: number;

  @ApiProperty()
  @Expose()
  downvoteCount: number;

  @ApiProperty()
  @Expose()
  commentCount: number;

  @ApiProperty({ enum: ['up_vote', 'down_vote', null], nullable: true })
  @Expose()
  myVote: 'up_vote' | 'down_vote' | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty({ type: () => [Tag] })
  @Expose()
  @Type(() => Tag)
  tags: Tag[];

  @ApiProperty({ type: [Number] })
  @Expose()
  languageIds: number[];
}

export class SolutionCommentResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  solutionId: number;

  @ApiProperty()
  @Expose()
  authorId: number;

  @ApiProperty({ type: () => User })
  @Expose()
  @Type(() => User)
  author: User;

  @ApiProperty()
  @Expose()
  content: string;

  @ApiProperty({ nullable: true })
  @Expose()
  parentId: number | null;

  @ApiProperty()
  @Expose()
  upvoteCount: number;

  @ApiProperty()
  @Expose()
  downvoteCount: number;

  @ApiProperty({
    description: 'Reply count (aliased as replyCounts for frontend)',
  })
  @Expose({ name: 'replyCount' }) // Map from entity replyCount
  replyCounts: number;

  @ApiProperty({ enum: ['up_vote', 'down_vote', null], nullable: true })
  @Expose()
  myVote: 'up_vote' | 'down_vote' | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}

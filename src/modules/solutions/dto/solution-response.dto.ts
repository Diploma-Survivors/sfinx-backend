import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Tag } from '../../problems/entities/tag.entity';
import { AuthorDto } from '../../users/dtos/author.dto';

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

  @ApiProperty({ type: () => AuthorDto })
  @Expose()
  @Type(() => AuthorDto)
  author: AuthorDto;

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

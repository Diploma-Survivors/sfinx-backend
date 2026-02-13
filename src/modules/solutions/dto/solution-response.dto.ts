import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Problem } from 'src/modules/problems/entities/problem.entity';
import { Tag } from '../../problems/entities/tag.entity';
import { AuthorDto } from '../../users/dto/author.dto';

export class SolutionResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  problemId: number;

  @ApiProperty({ type: () => Problem })
  @Expose()
  problem: Problem;

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

  @ApiProperty({ description: 'Net vote score (upvotes - downvotes)' })
  @Expose()
  voteScore: number;

  @ApiProperty()
  @Expose()
  commentCount: number;

  @ApiProperty({
    description:
      'Current user vote (1 for upvote, -1 for downvote, null if not voted)',
    enum: [1, -1, null],
    nullable: true,
  })
  @Expose()
  userVote: number | null;

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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSolutionCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsOptional()
  @IsInt()
  parentId?: number;
}

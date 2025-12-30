import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSolutionCommentDto {
  @ApiProperty({ description: 'Updated content' })
  @IsNotEmpty()
  @IsString()
  content: string;
}

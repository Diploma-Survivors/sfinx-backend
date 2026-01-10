import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BaseUpdateCommentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}

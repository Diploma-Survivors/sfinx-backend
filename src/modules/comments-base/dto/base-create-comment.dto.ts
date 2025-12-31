import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class BaseCreateCommentDto {
  @IsOptional()
  @IsNumber()
  parentId?: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}

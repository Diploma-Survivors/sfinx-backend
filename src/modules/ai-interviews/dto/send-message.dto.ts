import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  language?: string;
}

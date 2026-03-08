import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class EndInterviewDto {
  @IsString()
  @IsNotEmpty()
  sourceCode: string;

  @IsNumber()
  @IsNotEmpty()
  languageId: number;
}

import { IsNotEmpty, IsNumber } from 'class-validator';

export class StartInterviewDto {
  @IsNumber()
  @IsNotEmpty()
  problemId: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class UploadTestcaseDto {
  @ApiProperty({ description: 'Problem ID', type: Number })
  @IsInt()
  @IsNotEmpty()
  problemId: number;
}

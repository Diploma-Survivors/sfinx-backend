import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateSampleTestcaseDto {
  @ApiProperty({ description: 'Problem ID', type: Number })
  @IsInt()
  @IsNotEmpty()
  problemId: number;

  @ApiProperty({ description: 'Sample input', example: '[1,2,3,4]' })
  @IsString()
  @IsNotEmpty()
  input: string;

  @ApiProperty({ description: 'Expected output', example: '10' })
  @IsString()
  @IsNotEmpty()
  expectedOutput: string;

  @ApiProperty({
    description: 'Display order',
    required: false,
    default: 0,
    type: Number,
  })
  @IsInt()
  @IsOptional()
  orderIndex?: number = 0;

  @ApiProperty({
    description: 'Explanation of the sample',
    required: false,
    example: 'Sum of all elements: 1+2+3+4 = 10',
  })
  @IsString()
  @IsOptional()
  explanation?: string;
}

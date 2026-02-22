import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ProblemReportType } from '../entities/problem-report.entity';

export class CreateProblemReportDto {
  @ApiProperty({ description: 'ID of the problem being reported' })
  @IsInt()
  @IsNotEmpty()
  problemId: number;

  @ApiProperty({ description: 'Type of report', enum: ProblemReportType })
  @IsEnum(ProblemReportType)
  @IsNotEmpty()
  type: ProblemReportType;

  @ApiProperty({ description: 'Detailed description of the issue' })
  @IsString()
  @IsNotEmpty()
  description: string;
}

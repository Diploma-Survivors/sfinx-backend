import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProblemReportStatus } from '../entities/problem-report.entity';

export class UpdateProblemReportDto {
  @ApiProperty({ description: 'Resolution status', enum: ProblemReportStatus })
  @IsEnum(ProblemReportStatus)
  @IsNotEmpty()
  status: ProblemReportStatus;
}

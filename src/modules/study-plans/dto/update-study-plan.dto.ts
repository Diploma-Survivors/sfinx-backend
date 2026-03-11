import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';
import { CreateStudyPlanDto } from './create-study-plan.dto';

export class UpdateStudyPlanDto extends PartialType(CreateStudyPlanDto) {
  @ApiPropertyOptional({
    description: 'Plan status',
    enum: StudyPlanStatus,
  })
  @IsOptional()
  @IsEnum(StudyPlanStatus)
  status?: StudyPlanStatus;
}

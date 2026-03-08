import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSolutionDto } from './create-solution.dto';

export class UpdateSolutionDto extends PartialType(CreateSolutionDto) {}

export class AdminUpdateSolutionDto extends UpdateSolutionDto {
  @ApiPropertyOptional({ description: 'Mark as official editorial' })
  @IsOptional()
  @IsBoolean()
  isEditorial?: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class UpdatePlanFeaturesDto {
  @ApiProperty({ description: 'Array of Feature IDs', example: [1, 2, 3] })
  @IsArray()
  @IsInt({ each: true })
  featureIds: number[];
}

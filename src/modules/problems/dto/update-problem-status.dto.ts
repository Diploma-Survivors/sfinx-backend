import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateProblemStatusDto {
  @ApiProperty({
    description: 'Whether the problem should be active',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Array of permission IDs to assign to the role',
    example: [1, 2, 3, 5, 8],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  permissionIds: number[];
}

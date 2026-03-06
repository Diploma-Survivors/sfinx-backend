import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'The ID of the role to assign to the user',
    example: 2,
    type: Number,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  roleId: number;
}

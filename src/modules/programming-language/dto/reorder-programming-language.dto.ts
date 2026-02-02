import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class ReorderProgrammingLanguageDto {
  @ApiProperty({
    description: 'List of programming language IDs in the desired order',
    example: [1, 3, 2],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids: number[];
}

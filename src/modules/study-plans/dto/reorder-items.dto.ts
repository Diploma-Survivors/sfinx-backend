import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class ReorderItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsInt()
  id: number;

  @ApiProperty({ description: 'New day number' })
  @IsInt()
  @Min(1)
  dayNumber: number;

  @ApiProperty({ description: 'New order index within the day' })
  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class ReorderItemsDto {
  @ApiProperty({
    description: 'Items with new positions',
    type: [ReorderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}

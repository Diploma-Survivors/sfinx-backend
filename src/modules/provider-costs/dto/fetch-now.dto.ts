import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class FetchNowDto {
  @ApiProperty({
    example: '2024-01-15',
    description: 'Date to fetch provider usage for (YYYY-MM-DD, UTC)',
  })
  @IsDateString()
  date: string;
}

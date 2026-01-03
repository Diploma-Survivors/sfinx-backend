import { Entity, Column, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('system_parameters')
export class SystemParameter {
  @ApiProperty({ description: 'Configuration Key' })
  @PrimaryColumn()
  key: string;

  @ApiProperty({ description: 'Configuration Value (string/number/json)' })
  @Column({ type: 'text' })
  value: string;

  @ApiProperty({ description: 'Description of the parameter' })
  @Column({ nullable: true })
  description: string;
}

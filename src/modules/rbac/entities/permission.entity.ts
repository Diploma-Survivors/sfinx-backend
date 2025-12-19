import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('permissions')
@Unique(['resource', 'action'])
export class Permission {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({
    description: 'Resource name (e.g., problem, contest, submission)',
  })
  @Column({ length: 100 })
  resource: string;

  @ApiProperty({
    description: 'Action name (e.g., create, read, update, delete)',
  })
  @Column({ length: 100 })
  action: string;

  @ApiProperty({ description: 'Permission description', required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

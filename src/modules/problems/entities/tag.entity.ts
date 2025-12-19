import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tags')
export class Tag {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Tag name', example: 'Two Pointers' })
  @Column({ unique: true, length: 100 })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'two-pointers' })
  @Column({ unique: true, length: 100 })
  slug: string;

  @ApiProperty({
    description: 'Tag type',
    example: 'technique',
    required: false,
  })
  @Column({ length: 50, nullable: true })
  type: string;

  @ApiProperty({ description: 'Tag description', required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({
    description: 'Color for UI display (hex)',
    example: '#3B82F6',
    required: false,
  })
  @Column({ length: 7, nullable: true })
  color: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

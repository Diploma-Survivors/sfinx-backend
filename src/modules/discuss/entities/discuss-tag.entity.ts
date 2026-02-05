import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('discuss_tags')
export class DiscussTag {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Tag name', example: 'System Design' })
  @Column({ unique: true, length: 100 })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'system-design' })
  @Column({ unique: true, length: 100 })
  slug: string;

  @ApiProperty({
    description: 'Tag color hex code',
    example: '#FF0000',
    required: false,
  })
  @Column({ length: 7, nullable: true })
  color: string;

  @ApiProperty({ description: 'Description', required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Whether tag is active' })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('topics')
export class Topic {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Topic name', example: 'Array' })
  @Column({ unique: true, length: 100 })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'array' })
  @Column({ unique: true, length: 100 })
  slug: string;

  @ApiProperty({ description: 'Topic description', required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Icon URL', required: false })
  @Column({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl: string;

  @ApiProperty({ description: 'Display order index' })
  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @ApiProperty({ description: 'Whether topic is active' })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

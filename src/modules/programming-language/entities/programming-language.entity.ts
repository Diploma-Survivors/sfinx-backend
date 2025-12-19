import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('programming_languages')
export class ProgrammingLanguage {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Language name', example: 'Python 3' })
  @Column({ unique: true, length: 50 })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'python3' })
  @Column({ unique: true, length: 50 })
  slug: string;

  @ApiProperty({
    description: 'Judge0 language ID',
    example: 71,
    required: false,
  })
  @Column({ name: 'judge0_id', nullable: true })
  judge0Id: number;

  @ApiProperty({
    description: 'Monaco editor language identifier',
    example: 'python',
    required: false,
  })
  @Column({ name: 'monaco_language', nullable: true, length: 50 })
  monacoLanguage: string;

  @ApiProperty({ description: 'Whether language is active' })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Display order index' })
  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

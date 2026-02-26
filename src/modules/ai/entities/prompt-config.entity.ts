import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('prompt_configs')
export class PromptConfig {
  @ApiProperty({ description: 'Sequential ID' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({
    description: 'Unique feature key used by the application',
    example: 'interviewer',
  })
  @Column({ name: 'feature_name', unique: true, length: 100 })
  featureName: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of this prompt',
    example: 'AI interviewer system prompt',
  })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({
    description: 'Prompt name as registered in Langfuse',
    example: 'interviewer',
  })
  @Column({ name: 'langfuse_prompt_name', length: 200 })
  langfusePromptName: string;

  @ApiProperty({
    description: 'Langfuse label to fetch (e.g. "production", "staging")',
    example: 'production',
    default: 'production',
  })
  @Column({ name: 'langfuse_label', length: 50, default: 'production' })
  langfuseLabel: string;

  @ApiProperty({ description: 'Whether this config is active', default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

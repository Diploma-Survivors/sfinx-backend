import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Problem } from './problem.entity';

@Entity('sample_testcases')
export class SampleTestcase {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({
    description: 'Problem this sample belongs to',
    type: () => Problem,
  })
  @ManyToOne(() => Problem, (problem) => problem.sampleTestcases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ApiProperty({ description: 'Sample input' })
  @Column({ type: 'text' })
  input: string;

  @ApiProperty({ description: 'Expected output' })
  @Column({ name: 'expected_output', type: 'text' })
  expectedOutput: string;

  @ApiProperty({ description: 'Display order', default: 0 })
  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @ApiProperty({ description: 'Explanation of the sample', required: false })
  @Column({ type: 'text', nullable: true })
  explanation: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

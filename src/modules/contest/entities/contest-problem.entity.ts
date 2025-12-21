import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';
import { Contest } from './contest.entity';

@Entity('contest_problems')
export class ContestProblem {
  @ApiProperty({ description: 'Contest ID' })
  @PrimaryColumn('int', { name: 'contest_id' })
  contestId: number;

  @ApiProperty({ description: 'Problem ID' })
  @PrimaryColumn('int', { name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'Contest', type: () => Contest })
  @ManyToOne(() => Contest, (contest) => contest.contestProblems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contest_id' })
  contest: Contest;

  @ApiProperty({ description: 'Problem', type: () => Problem })
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ApiProperty({
    description: 'Points for this problem',
    example: 100,
    default: 100,
  })
  @Column({ default: 100 })
  points: number;

  @ApiProperty({
    description: 'Display order in contest',
    example: 0,
    default: 0,
  })
  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @ApiPropertyOptional({
    description: 'Problem label (e.g., A, B, C)',
    example: 'A',
  })
  @Column({ type: 'varchar', length: 10, nullable: true })
  label: string | null;
}

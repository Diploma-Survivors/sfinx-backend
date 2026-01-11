import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_statistics')
export class UserStatistics {
  @ApiProperty({ description: 'User ID' })
  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @OneToOne(() => User, (user) => user.statistics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({
    description: 'Global score based on problem difficulty',
    default: 0,
  })
  @Column({
    name: 'global_score',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  globalScore: number;

  @ApiProperty({ description: 'Total number of solved problems', default: 0 })
  @Column({ name: 'total_solved', default: 0 })
  totalSolved: number;

  @ApiProperty({
    description: 'Total number of attempted problems',
    default: 0,
  })
  @Column({ name: 'total_attempts', default: 0 })
  totalAttempts: number;

  @ApiProperty({ description: 'Count of solved Easy problems', default: 0 })
  @Column({ name: 'solved_easy', default: 0 })
  solvedEasy: number;

  @ApiProperty({ description: 'Count of solved Medium problems', default: 0 })
  @Column({ name: 'solved_medium', default: 0 })
  solvedMedium: number;

  @ApiProperty({ description: 'Count of solved Hard problems', default: 0 })
  @Column({ name: 'solved_hard', default: 0 })
  solvedHard: number;

  @ApiProperty({ description: 'Last time a problem was solved' })
  @Column({ name: 'last_solve_at', type: 'timestamptz', nullable: true })
  lastSolveAt: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

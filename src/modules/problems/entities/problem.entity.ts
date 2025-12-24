import { ApiProperty } from '@nestjs/swagger';
import { UserProblemProgress } from 'src/modules/submissions/entities/user-problem-progress.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { ProblemDifficulty } from '../enums/problem-difficulty.enum';
import { SampleTestcase } from './sample-testcase.entity';
import { Tag } from './tag.entity';
import { Topic } from './topic.entity';

export class ProblemHint {
  @ApiProperty({
    description: 'Hint order',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'Hint content',
    example: 'Think about using a hash map',
  })
  content: string;
}

@Entity('problems')
export class Problem {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Problem title', example: 'Two Sum' })
  @Column({ length: 255 })
  title: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'two-sum' })
  @Column({ unique: true, length: 255 })
  slug: string;

  @ApiProperty({ description: 'Problem description in markdown' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Input constraints', required: false })
  @Column({ type: 'text', nullable: true })
  constraints: string;

  @Column({
    type: 'tsvector',
    select: false,
    nullable: true,
    name: 'search_vector',
  })
  searchVector?: string;

  @ApiProperty({
    description: 'Problem difficulty',
    enum: ProblemDifficulty,
    example: ProblemDifficulty.MEDIUM,
  })
  @Column({
    type: 'enum',
    enum: ProblemDifficulty,
  })
  difficulty: ProblemDifficulty;

  @ApiProperty({ description: 'Whether problem requires premium' })
  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @ApiProperty({ description: 'Whether problem is active' })
  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  // Statistics
  @ApiProperty({ description: 'Total number of submissions' })
  @Column({ name: 'total_submissions', default: 0 })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total number of accepted submissions' })
  @Column({ name: 'total_accepted', default: 0 })
  totalAccepted: number;

  @ApiProperty({ description: 'Acceptance rate percentage', example: 45.5 })
  @Column({
    name: 'acceptance_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  acceptanceRate: number;

  @ApiProperty({ description: 'Total number of unique users who attempted' })
  @Column({ name: 'total_attempts', default: 0 })
  totalAttempts: number;

  @ApiProperty({ description: 'Total number of unique users who solved' })
  @Column({ name: 'total_solved', default: 0 })
  totalSolved: number;

  @ApiProperty({
    description: 'Average time to solve in seconds (contest only)',
    required: false,
  })
  @Column({ name: 'average_time_to_solve', nullable: true })
  averageTimeToSolve: number;

  @ApiProperty({
    description: 'Community-based difficulty rating (1-10)',
    required: false,
  })
  @Column({
    name: 'difficulty_rating',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  difficultyRating: number;

  // Testcases
  @ApiProperty({ description: 'S3 key for the testcase file', required: false })
  @Column({ name: 'testcase_file_key', type: 'text', nullable: true })
  testcaseFileKey: string | null;

  @ApiProperty({ description: 'Number of testcases in the file', default: 0 })
  @Column({ name: 'testcase_count', default: 0 })
  testcaseCount: number;

  @ApiProperty({
    description: 'Time limit in milliseconds for code execution',
    example: 2000,
    default: 2000,
  })
  @Column({ name: 'time_limit_ms', default: 2000 })
  timeLimitMs: number;

  @ApiProperty({
    description: 'Memory limit in kilobytes for code execution',
    example: 256000,
    default: 256000,
  })
  @Column({ name: 'memory_limit_kb', default: 256000 })
  memoryLimitKb: number;

  @ApiProperty({
    description: 'Sample testcases shown to users',
    type: () => [SampleTestcase],
  })
  @OneToMany(() => SampleTestcase, (sample) => sample.problem, {
    cascade: true,
  })
  sampleTestcases: SampleTestcase[];

  @ApiProperty({
    description: 'User progress on this problem',
    type: () => [UserProblemProgress],
    required: false,
  })
  @OneToMany(() => UserProblemProgress, (progress) => progress.problem)
  userProgress?: UserProblemProgress[];

  @ApiProperty({
    description: 'Progressive hints array',
    type: () => [ProblemHint],
    example: [{ order: 1, content: 'Think about using a hash map' }],
  })
  @Column({ type: 'jsonb', default: [] })
  hints: ProblemHint[];

  // Official solution
  @ApiProperty({ description: 'Whether official solution exists' })
  @Column({ name: 'has_official_solution', default: false })
  hasOfficialSolution: boolean;

  @ApiProperty({
    description: 'Official solution content in markdown',
    required: false,
  })
  @Column({ name: 'official_solution_content', type: 'text', nullable: true })
  officialSolutionContent: string;

  // Relationships
  @ApiProperty({
    description: 'User who created the problem',
    type: () => User,
    required: false,
  })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ApiProperty({
    description: 'User who last updated the problem',
    type: () => User,
    required: false,
  })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @ApiProperty({
    description: 'Array of similar problem IDs',
    example: [1, 2, 3],
  })
  @Column({ name: 'similar_problems', type: 'int', array: true, default: [] })
  similarProblems: number[];

  @ApiProperty({
    description: 'Topics associated with this problem',
    type: () => [Topic],
  })
  @ManyToMany(() => Topic)
  @JoinTable({
    name: 'problem_topics',
    joinColumn: { name: 'problem_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'topic_id', referencedColumnName: 'id' },
  })
  topics: Topic[];

  @ApiProperty({
    description: 'Tags associated with this problem',
    type: () => [Tag],
  })
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'problem_tags',
    joinColumn: { name: 'problem_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

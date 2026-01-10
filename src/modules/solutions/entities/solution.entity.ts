import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Problem } from '../../problems/entities/problem.entity';
import { Tag } from '../../problems/entities/tag.entity';
import { ProgrammingLanguage } from '../../programming-language';
import { User } from '../../auth/entities/user.entity';

@Entity('solutions')
export class Solution {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Problem ID' })
  @Column({ name: 'problem_id' })
  problemId: number;

  @ApiProperty({ description: 'Author ID' })
  @Column({ name: 'author_id' })
  authorId: number;

  @ApiProperty({ description: 'Solution title' })
  @Column()
  title: string;

  @ApiProperty({ description: 'Solution content (Markdown)' })
  @Column('text')
  content: string;

  @ApiProperty({ description: 'Total upvotes count', default: 0 })
  @Column({ name: 'upvote_count', default: 0 })
  upvoteCount: number;

  @ApiProperty({ description: 'Total downvotes count', default: 0 })
  @Column({ name: 'downvote_count', default: 0 })
  downvoteCount: number;

  @ApiProperty({
    description: 'Net vote score (upvotes - downvotes)',
    default: 0,
  })
  @Column({ name: 'vote_score', default: 0 })
  voteScore: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ApiProperty({ type: () => Problem })
  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ApiProperty({ type: () => [Tag] })
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'solution_tags',
    joinColumn: { name: 'solution_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @ApiProperty({ type: () => [ProgrammingLanguage] })
  @ManyToMany(() => ProgrammingLanguage)
  @JoinTable({
    name: 'solution_languages',
    joinColumn: { name: 'solution_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'language_id', referencedColumnName: 'id' },
  })
  languages: ProgrammingLanguage[];

  // Non-column properties (filled manually)
  @ApiProperty({
    description:
      'Current user vote (1 for upvote, -1 for downvote, null if not voted)',
    enum: [1, -1, null],
    nullable: true,
  })
  userVote: number | null;

  @ApiProperty({ description: 'Total comments count', default: 0 })
  @Column({ name: 'comment_count', default: 0 })
  commentCount: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/auth/entities/user.entity';
import { Problem } from 'src/modules/problems/entities/problem.entity';
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

@Entity('favorite_lists')
export class FavoriteList {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'List name', example: 'My Favorite Problems' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({
    description: 'List description',
    example: 'A collection of difficult DP problems',
  })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({
    description: 'List icon (URL or emoji)',
    example: 'https://...',
  })
  @Column({
    length: 500,
    default:
      'https://play-lh.googleusercontent.com/2X1xHmYDF33roRwWqJOUgiFvF4Bi8fUbaw3mkODIasg68WIJM_9kmA9akRZUi3k5jaZ278RqpB4vatLOMRSKERc',
  })
  icon: string;

  @ApiProperty({ description: 'Whether list is public', default: false })
  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @ApiProperty({
    description: 'Whether this is the default Favorite list',
    default: false,
  })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @ApiProperty({
    description: 'User who owns this list',
    type: () => User,
  })
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({
    description: 'Problems in this list',
    type: () => [Problem],
  })
  @ManyToMany(() => Problem)
  @JoinTable({
    name: 'favorite_list_problems',
    joinColumn: { name: 'list_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'problem_id', referencedColumnName: 'id' },
  })
  problems: Problem[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

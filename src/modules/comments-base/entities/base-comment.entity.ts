import {
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export abstract class BaseComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'author_id' })
  authorId: number;

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @Column('text')
  content: string;

  @Column({ name: 'upvote_count', default: 0 })
  upvoteCount: number;

  @Column({ name: 'downvote_count', default: 0 })
  downvoteCount: number;

  @Column({ name: 'reply_count', default: 0 })
  replyCount: number;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({ name: 'is_edited', default: false })
  isEdited: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'vote_score', default: 0 })
  voteScore: number;

  @Column({
    name: 'edited_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  editedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  // Non-column properties
  myVote: 'up_vote' | 'down_vote' | null;
}

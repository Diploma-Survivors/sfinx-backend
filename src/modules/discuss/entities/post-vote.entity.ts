import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VoteType } from '../../comments-base/enums'; // Assuming VoteType is in comments-base or shared enum
import { Post } from './post.entity';
import { User } from '../../auth/entities/user.entity'; // Adjust path if needed

@Entity('discuss_post_votes')
@Unique(['userId', 'postId'])
export class PostVote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'post_id', type: 'uuid' }) // Post ID is uuid
  postId: string;

  @Column({
    name: 'vote_type',
    type: 'varchar',
    length: 10,
    comment: 'UP or DOWN',
  })
  voteType: VoteType;

  @ManyToOne(() => Post, (post) => post.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

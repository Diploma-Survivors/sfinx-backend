import { Entity, JoinColumn, ManyToOne, OneToMany, Column } from 'typeorm';
import { BaseComment } from '../../comments-base/entities/base-comment.entity';
import { Post } from './post.entity';
import { PostCommentVote } from './post-comment-vote.entity';

@Entity('discuss_comments')
export class PostComment extends BaseComment {
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @OneToMany(() => PostCommentVote, (vote) => vote.comment)
  votes: PostCommentVote[];

  @ManyToOne(() => PostComment, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: PostComment;

  @OneToMany(() => PostComment, (comment) => comment.parent)
  children: PostComment[];
}

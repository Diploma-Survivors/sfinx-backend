import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Language } from 'src/modules/auth/enums';
import { DataSource, In, Repository } from 'typeorm';
import { BaseCommentsService } from '../../comments-base/base-comments.service';
import { BaseCommentResponseDto } from '../../comments-base/dto';
import { VoteType } from '../../comments-base/enums';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { StorageService } from '../../storage/storage.service';
import { CreatePostCommentDto } from '../dto/create-post-comment.dto';
import { UpdatePostCommentDto } from '../dto/update-post-comment.dto';
import { PostCommentVote } from '../entities/post-comment-vote.entity';
import { PostComment } from '../entities/post-comment.entity';
import { Post } from '../entities/post.entity';

type CommentResponse = BaseCommentResponseDto & { replies: CommentResponse[] };

@Injectable()
export class DiscussCommentService extends BaseCommentsService<
  PostComment,
  PostCommentVote,
  CreatePostCommentDto,
  UpdatePostCommentDto
> {
  constructor(
    @InjectRepository(PostComment)
    protected readonly commentRepo: Repository<PostComment>,

    @InjectRepository(PostCommentVote)
    protected readonly voteRepo: Repository<PostCommentVote>,

    @InjectRepository(Post)
    protected readonly postRepo: Repository<Post>,

    protected readonly storageService: StorageService,

    @InjectDataSource()
    protected readonly dataSource: DataSource,

    private readonly notificationsService: NotificationsService,
  ) {
    super(commentRepo, voteRepo, storageService, dataSource);
  }

  protected getCommentEntityName(): string {
    return PostComment.name;
  }

  protected getVoteEntityName(): string {
    return PostCommentVote.name;
  }

  protected createVoteEntity(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): PostCommentVote {
    const vote = new PostCommentVote();
    vote.commentId = commentId;
    vote.userId = userId;
    vote.voteType = voteType;
    return vote;
  }

  protected getParentRelationIdField(): string {
    return 'postId';
  }

  // Override getComments to handle UUID postId
  async getPostComments(postId: string, userId?: number) {
    const comments = await this.commentRepo.find({
      where: {
        postId: postId,
      },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    let userVotes: Map<number, number> | null = null;
    if (userId) {
      const ids = comments.map((c) => c.id);
      userVotes = await this.getUserVotes(ids, userId);
    }

    // Build tree
    const commentMap = new Map<number, CommentResponse>();
    const roots: CommentResponse[] = [];

    // First pass: map all comments
    comments.forEach((comment) => {
      const dto = this.mapToResponseDto(comment, userVotes);
      commentMap.set(comment.id, { ...dto, replies: [] });
    });

    // Second pass: structure into tree
    comments.forEach((comment) => {
      const dto = commentMap.get(comment.id);
      if (dto && comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(dto);
        } else {
          // Parent might be deleted or not fetched (shouldn't happen with standard fetch)
          // Treat as root or orphan? For now, if parent not found, it won't be in the tree
        }
      } else if (dto) {
        roots.push(dto);
      }
    });

    return roots;
  }

  async createPostComment(
    userId: number,
    postId: string,
    dto: CreatePostCommentDto,
  ) {
    const comment = this.commentRepo.create({
      ...dto,
      authorId: userId,
      postId: postId,
      parentId: dto.parentId || null,
    });

    const saved = await this.commentRepo.save(comment);

    // Update post comment count
    await this.postRepo.increment({ id: postId }, 'commentCount', 1);

    if (saved.parentId) {
      await this.commentRepo
        .createQueryBuilder()
        .update()
        .set({
          replyCount: () => 'reply_count + 1',
        })
        .where('id = :id', { id: saved.parentId })
        .execute();
    }

    const createdComment = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    if (!createdComment) {
      throw new Error('Comment not found after creation');
    }

    if (saved.parentId) {
      const parentComment = await this.commentRepo.findOne({
        where: { id: saved.parentId },
      });
      if (parentComment && parentComment.authorId !== userId) {
        await this.notificationsService.create({
          recipientId: parentComment.authorId,
          senderId: userId,
          type: NotificationType.REPLY,
          translations: [
            {
              languageCode: Language.EN,
              title: 'New Reply to Your Comment',
              content: `${createdComment.author?.username || 'Someone'} replied to your comment.`,
            },
            {
              languageCode: Language.VI,
              title: 'Có người trả lời bình luận của bạn',
              content: `${createdComment.author?.username || 'Ai đó'} đã trả lời bình luận của bạn.`,
            },
          ],
          link: `/discuss/${postId}`,
        });
      }
    } else {
      const post = await this.postRepo.findOne({
        where: { id: postId },
        relations: ['author'],
      });
      if (post && post.author?.id !== userId) {
        await this.notificationsService.create({
          recipientId: post.author.id,
          senderId: userId,
          type: NotificationType.COMMENT,
          translations: [
            {
              languageCode: Language.EN,
              title: 'New Comment on Your Post',
              content: `${createdComment.author?.username || 'Someone'} commented on your post "${post.title}".`,
            },
            {
              languageCode: Language.VI,
              title: 'Có bình luận mới trên bài viết của bạn',
              content: `${createdComment.author?.username || 'Ai đó'} đã bình luận trên bài viết "${post.title}" của bạn.`,
            },
          ],
          link: `/discuss/${postId}`,
        });
      }
    }

    return this.mapToResponseDto(createdComment);
  }
  async deleteComment(
    id: number,
    userId: number,
    isAdmin = false,
  ): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      select: ['id', 'authorId', 'postId', 'parentId'],
    });

    if (!comment) throw new NotFoundException('Comment not found');

    if (!isAdmin && comment.authorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this comment',
      );
    }

    // Fetch all comments of the post to find descendants efficiently
    const allPostComments = await this.commentRepo.find({
      where: { postId: comment.postId },
      select: ['id', 'parentId'],
    });

    // BFS to find all descendants
    const idsToDelete = new Set<number>();
    idsToDelete.add(id);

    const queue = [id];
    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = allPostComments.filter((c) => c.parentId === currentId);
      for (const child of children) {
        if (!idsToDelete.has(child.id)) {
          idsToDelete.add(child.id);
          queue.push(child.id);
        }
      }
    }

    // Delete all identified comments
    await this.commentRepo.delete({ id: In(Array.from(idsToDelete)) });

    // Update post comment count
    await this.postRepo.decrement(
      { id: comment.postId },
      'commentCount',
      idsToDelete.size,
    );

    // Update parent reply count if this was a reply
    if (comment.parentId) {
      await this.commentRepo
        .createQueryBuilder()
        .update()
        .set({
          replyCount: () => 'reply_count - 1',
        })
        .where('id = :id', { id: comment.parentId })
        .execute();
    }
  }

  async voteComment(
    commentId: number,
    userId: number,
    voteType: VoteType,
  ): Promise<void> {
    const existingVote = await this.voteRepo
      .createQueryBuilder('vote')
      .where('vote.commentId = :commentId', { commentId })
      .andWhere('vote.userId = :userId', { userId })
      .getOne();

    await this.dataSource.transaction(async (manager) => {
      if (existingVote) {
        // Fix: Cast existingVote.voteType to number for strict comparison
        const currentVoteType = Number(existingVote.voteType);

        if (currentVoteType === Number(voteType)) {
          // Toggle off
          await manager.getRepository(this.getVoteEntityName()).delete({
            commentId,
            userId,
          });
          await this.updateCommentVoteCounts(manager, commentId);
        } else {
          // Switch vote
          existingVote.voteType = voteType;
          await manager.save(existingVote);
          await this.updateCommentVoteCounts(manager, commentId);
        }
      } else {
        // Create new vote
        const newVote = this.createVoteEntity(commentId, userId, voteType);
        await manager.save(newVote);
        await this.updateCommentVoteCounts(manager, commentId);
      }
    });
  }

  async unvoteComment(commentId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(this.getVoteEntityName()).delete({
        commentId,
        userId,
      });
      await this.updateCommentVoteCounts(manager, commentId);
    });
  }

  // Override getUserVotes to ensure number return type
  async getUserVotes(
    commentIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    const map = await super.getUserVotes(commentIds, userId);
    const correctedMap = new Map<number, number>();
    map.forEach((value, key) => {
      correctedMap.set(key, Number(value));
    });
    return correctedMap;
  }
}

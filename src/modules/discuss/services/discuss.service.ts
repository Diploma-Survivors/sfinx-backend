import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Language } from 'src/modules/auth/enums';
import { StorageService } from 'src/modules/storage/storage.service';
import { In, Repository } from 'typeorm';
import { PaginatedResultDto } from '../../../common';
import { VoteType } from '../../comments-base/enums';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreatePostDto, FilterPostDto, UpdatePostDto } from '../dto';
import { DiscussTag } from '../entities/discuss-tag.entity';
import { PostVote } from '../entities/post-vote.entity';
import { Post } from '../entities/post.entity';
import { DiscussTagService } from './discuss-tag.service';

@Injectable()
export class DiscussService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(DiscussTag)
    private readonly tagRepository: Repository<DiscussTag>,
    @InjectRepository(PostVote)
    private readonly postVoteRepository: Repository<PostVote>,
    private readonly discussTagService: DiscussTagService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPost(userId: number, dto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create({
      ...dto,
      author: { id: userId },
      slug: this.generateSlug(dto.title),
    });

    if (dto.tagIds && dto.tagIds.length > 0) {
      const tags = await this.tagRepository.findBy({ id: In(dto.tagIds) });
      post.tags = tags;
    }

    const savedPost = await this.postRepository.save(post);

    await this.notificationsService.create({
      recipientId: userId,
      type: NotificationType.SYSTEM,
      translations: [
        {
          languageCode: Language.EN,
          title: 'Discuss Post Published',
          content: `Your discussion post "${dto.title}" has been successfully published.`,
        },
        {
          languageCode: Language.VI,
          title: 'Bài viết đã được đăng',
          content: `Bài viết thảo luận "${dto.title}" của bạn đã được đăng thành công.`,
        },
      ],
      link: `/discuss/${savedPost.id}`,
    });

    return savedPost;
  }

  async findAll(query: FilterPostDto): Promise<PaginatedResultDto<Post>> {
    const {
      page = 1,
      limit = 20,
      search,
      tagIds,
      sortBy,
      sortOrder,
      userId,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.tags', 'tags')
      .loadRelationCountAndMap('post.replyCount', 'post.comments')
      .where('post.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      queryBuilder.andWhere('post.title ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (tagIds && tagIds.length > 0) {
      queryBuilder.andWhere('tags.id IN (:...tagIds)', { tagIds });
    }

    if (userId) {
      queryBuilder.andWhere('author.id = :userId', { userId });
    }

    if (sortBy === 'trending') {
      queryBuilder
        .addSelect(
          '(COALESCE(post.upvoteCount, 0) - COALESCE(post.downvoteCount, 0))',
          'vote_score',
        )
        .orderBy('vote_score', sortOrder || 'DESC')
        .addOrderBy('post.createdAt', 'DESC');
    } else if (sortBy === 'newest') {
      queryBuilder.orderBy('post.createdAt', sortOrder || 'DESC');
    } else if (sortBy) {
      queryBuilder.orderBy(`post.${sortBy}`, sortOrder || 'DESC');
    } else {
      queryBuilder.orderBy('post.createdAt', 'DESC');
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Transform author avatarUrl
    items.forEach((item) => {
      if (item.author?.avatarKey && this.isS3Key(item.author.avatarKey)) {
        Object.assign(item.author, {
          avatarUrl: this.storageService.getCloudFrontUrl(
            item.author.avatarKey,
          ),
        });
      }
    });

    return new PaginatedResultDto(items, {
      page,
      limit,
      total,
    });
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['author', 'tags'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Transform author avatarUrl
    if (post.author?.avatarKey && this.isS3Key(post.author.avatarKey)) {
      Object.assign(post.author, {
        avatarUrl: this.storageService.getCloudFrontUrl(post.author.avatarKey),
      });
    }

    return post;
  }

  async incrementViewCount(id: string): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.postRepository.increment({ id }, 'viewCount', 1);
  }

  async updatePost(
    id: string,
    userId: number,
    dto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.findOne(id);

    if (post.author.id !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    if (dto.title) {
      post.title = dto.title;
      post.slug = this.generateSlug(dto.title);
    }
    if (dto.content) {
      post.content = dto.content;
    }

    if (dto.tagIds) {
      const tags = await this.tagRepository.findBy({ id: In(dto.tagIds) });
      post.tags = tags;
    }

    return this.postRepository.save(post);
  }

  async deletePost(id: string, userId: number): Promise<void> {
    const post = await this.findOne(id);

    if (post.author.id !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    post.isDeleted = true;
    await this.postRepository.save(post);
  }

  async adminDeletePost(id: string): Promise<void> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    post.isDeleted = true;
    await this.postRepository.save(post);
  }

  async findAllAdmin(
    query: FilterPostDto,
    showDeleted = false,
  ): Promise<PaginatedResultDto<Post>> {
    const {
      page = 1,
      limit = 20,
      search,
      tagIds,
      sortBy,
      sortOrder,
      userId,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.tags', 'tags')
      .loadRelationCountAndMap('post.replyCount', 'post.comments');

    if (!showDeleted) {
      queryBuilder.where('post.isDeleted = :isDeleted', { isDeleted: false });
    }

    if (search) {
      queryBuilder.andWhere('post.title ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (tagIds && tagIds.length > 0) {
      queryBuilder.andWhere('tags.id IN (:...tagIds)', { tagIds });
    }

    if (userId) {
      queryBuilder.andWhere('author.id = :userId', { userId });
    }

    if (sortBy === 'trending') {
      queryBuilder
        .addSelect(
          '(COALESCE(post.upvoteCount, 0) - COALESCE(post.downvoteCount, 0))',
          'vote_score',
        )
        .orderBy('vote_score', sortOrder || 'DESC')
        .addOrderBy('post.createdAt', 'DESC');
    } else if (sortBy === 'newest' || !sortBy) {
      queryBuilder.orderBy('post.createdAt', sortOrder || 'DESC');
    } else {
      queryBuilder.orderBy(`post.${sortBy}`, sortOrder || 'DESC');
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    items.forEach((item) => {
      if (item.author?.avatarKey && this.isS3Key(item.author.avatarKey)) {
        Object.assign(item.author, {
          avatarUrl: this.storageService.getCloudFrontUrl(
            item.author.avatarKey,
          ),
        });
      }
    });

    return new PaginatedResultDto(items, { page, limit, total });
  }

  async votePost(
    userId: number,
    postId: string,
    voteType: VoteType,
  ): Promise<{ upvoteCount: number; downvoteCount: number }> {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const existingVote = await this.postVoteRepository.findOne({
      where: { userId, postId },
    });

    if (existingVote) {
      const currentVoteType = Number(existingVote.voteType);

      if (currentVoteType === Number(voteType)) {
        await this.postVoteRepository.remove(existingVote);
        if (voteType === VoteType.UPVOTE) {
          await this.postRepository.update(
            { id: postId },
            { upvoteCount: () => 'GREATEST(upvote_count - 1, 0)' },
          );
        } else {
          await this.postRepository.update(
            { id: postId },
            { downvoteCount: () => 'GREATEST(downvote_count - 1, 0)' },
          );
        }
      } else {
        // Switch vote
        existingVote.voteType = voteType;
        await this.postVoteRepository.save(existingVote);
        if (voteType === VoteType.UPVOTE) {
          await this.postRepository.increment({ id: postId }, 'upvoteCount', 1);
          await this.postRepository.update(
            { id: postId },
            { downvoteCount: () => 'GREATEST(downvote_count - 1, 0)' },
          );
        } else {
          await this.postRepository.increment(
            { id: postId },
            'downvoteCount',
            1,
          );
          await this.postRepository.update(
            { id: postId },
            { upvoteCount: () => 'GREATEST(upvote_count - 1, 0)' },
          );
        }
      }
    } else {
      const newVote = this.postVoteRepository.create({
        userId,
        postId,
        voteType,
      });
      await this.postVoteRepository.save(newVote);
      if (voteType === VoteType.UPVOTE) {
        await this.postRepository.increment({ id: postId }, 'upvoteCount', 1);
      } else {
        await this.postRepository.increment({ id: postId }, 'downvoteCount', 1);
      }
    }

    // Fetch updated post to return accurate counts
    const updatedPost = await this.postRepository.findOne({
      where: { id: postId },
    });

    return {
      upvoteCount: updatedPost!.upvoteCount,
      downvoteCount: updatedPost!.downvoteCount,
    };
  }

  async unvotePost(userId: number, postId: string): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const existingVote = await this.postVoteRepository.findOne({
      where: { userId, postId },
    });

    if (existingVote) {
      await this.postVoteRepository.remove(existingVote);
      // Fix: Cast existingVote.voteType to number just in case
      const currentVoteType = Number(existingVote.voteType);

      if (currentVoteType === Number(VoteType.UPVOTE)) {
        await this.postRepository.update(
          { id: postId },
          { upvoteCount: () => 'GREATEST(upvote_count - 1, 0)' },
        );
      } else {
        await this.postRepository.update(
          { id: postId },
          { downvoteCount: () => 'GREATEST(downvote_count - 1, 0)' },
        );
      }
    }
  }

  async getUserVoteForPost(
    userId: number,
    postId: string,
  ): Promise<VoteType | null> {
    const vote = await this.postVoteRepository.findOne({
      where: { userId, postId },
    });

    return vote ? Number(vote.voteType) : null;
  }

  private generateSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 7)
    );
  }

  private isS3Key(value: string): boolean {
    if (!value) return false;
    return !value.startsWith('http://') && !value.startsWith('https://');
  }
}

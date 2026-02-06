import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResultDto } from '../../../common';
import {
  CreatePostDto,
  FilterPostDto,
  FilterTagDto,
  UpdatePostDto,
} from '../dto';
import { DiscussTag } from '../entities/discuss-tag.entity';
import { Post } from '../entities/post.entity';
import { PostVote } from '../entities/post-vote.entity';
import { VoteType } from '../../comments-base/enums';

@Injectable()
export class DiscussService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(DiscussTag)
    private readonly tagRepository: Repository<DiscussTag>,
    @InjectRepository(PostVote)
    private readonly postVoteRepository: Repository<PostVote>,
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

    return this.postRepository.save(post);
  }

  async findAll(query: FilterPostDto): Promise<PaginatedResultDto<Post>> {
    const { page = 1, limit = 20, search, tagIds, sortBy, sortOrder } = query;
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

    if (sortBy) {
      queryBuilder.orderBy(`post.${sortBy}`, sortOrder || 'DESC');
    } else {
      queryBuilder.orderBy('post.createdAt', 'DESC');
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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

    // Increment view count
    await this.postRepository.increment({ id }, 'viewCount', 1);

    return post;
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

  async findAllTags(
    query: FilterTagDto = {},
  ): Promise<PaginatedResultDto<DiscussTag>> {
    const { page = 1, limit = 100, isActive } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.tagRepository.createQueryBuilder('tag');

    if (isActive !== undefined) {
      queryBuilder.where('tag.isActive = :isActive', { isActive });
    }

    queryBuilder.orderBy('tag.name', 'ASC');

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResultDto(items, {
      page,
      limit,
      total,
    });
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
      // Fix: Cast existingVote.voteType to number for strict comparison
      // Database might return string if column type is varchar
      const currentVoteType = Number(existingVote.voteType);

      if (currentVoteType === Number(voteType)) {
        // Already voted this way, remove vote (toggle off)
        await this.postVoteRepository.remove(existingVote);
        if (voteType === VoteType.UPVOTE) {
          // Prevent negative counts
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
}

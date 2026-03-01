import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResultDto } from '../../../common';
import {
  CreateDiscussionTagDto,
  FilterTagDto,
  UpdateDiscussionTagDto,
} from '../dto';
import { DiscussTag } from '../entities/discuss-tag.entity';

@Injectable()
export class DiscussTagService {
  constructor(
    @InjectRepository(DiscussTag)
    private readonly tagRepository: Repository<DiscussTag>,
  ) {}

  async findAllTags(
    query: FilterTagDto = {},
  ): Promise<PaginatedResultDto<DiscussTag>> {
    const { page = 1, limit = 100, isActive, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.tagRepository.createQueryBuilder('tag');

    if (isActive !== undefined) {
      queryBuilder.andWhere('tag.isActive = :isActive', { isActive });
    }

    if (search) {
      queryBuilder.andWhere('tag.name ILIKE :search', {
        search: `%${search}%`,
      });
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

  async createTag(dto: CreateDiscussionTagDto): Promise<DiscussTag> {
    const slug = this.generateSlug(dto.name);
    const tag = this.tagRepository.create({
      ...dto,
      slug,
    });
    return this.tagRepository.save(tag);
  }

  async updateTag(
    id: number,
    dto: UpdateDiscussionTagDto,
  ): Promise<DiscussTag> {
    const tag = await this.tagRepository.findOneBy({ id });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    if (dto.name) {
      tag.name = dto.name;
      tag.slug = this.generateSlug(dto.name);
    }
    if (dto.color) tag.color = dto.color;
    if (dto.description) tag.description = dto.description;

    return this.tagRepository.save(tag);
  }

  async deleteTag(id: number): Promise<void> {
    const tag = await this.tagRepository.findOneBy({ id });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }
    await this.tagRepository.remove(tag);
  }

  async getTrendingTopics(limit: number = 5): Promise<
    Array<{
      id: number;
      name: string;
      slug: string;
      color: string;
      postCount: number;
    }>
  > {
    interface TrendingTopicRaw {
      id: number;
      name: string;
      slug: string;
      color: string;
      postCount: string;
    }

    const queryBuilder = this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('discuss_post_tags', 'post_tags', 'post_tags.tag_id = tag.id')
      .select([
        'tag.id AS id',
        'tag.name AS name',
        'tag.slug AS slug',
        'tag.color AS color',
        'COUNT(post_tags.post_id) AS "postCount"',
      ])
      .groupBy('tag.id, tag.name, tag.slug, tag.color')
      .orderBy('"postCount"', 'DESC')
      .limit(limit);

    const result = await queryBuilder.getRawMany<TrendingTopicRaw>();

    return result.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      color: item.color,
      postCount: Number(item.postCount),
    }));
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

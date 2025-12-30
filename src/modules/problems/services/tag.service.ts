import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import slugify from 'slugify';

import { In, Repository } from 'typeorm';

import { Transactional } from 'typeorm-transactional';
import { CACHE_TTL } from '../../../common/constants/cache.constant';
import {
  Cacheable,
  CacheInvalidate,
} from '../../../common/decorators/cacheable.decorator';
import { PaginatedResultDto, SortOrder } from '../../../common/dto';
import { FindOptionsWhere } from 'typeorm';
import { CacheKeys } from '../../redis/utils/cache-key.builder';
import { Tag } from '../entities/tag.entity';
import { FilterTagDto } from '../dto/filter-tag.dto';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  /**
   * Get all tags (cached for 1 day)
   */
  @Cacheable({
    key: CacheKeys.tag.all(),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findAll(): Promise<Tag[]> {
    return this.tagRepository.find({
      order: { name: SortOrder.ASC },
    });
  }

  /**
   * Get paginated tags for admin
   */
  async findAllPaginated(
    query: FilterTagDto,
  ): Promise<PaginatedResultDto<Tag>> {
    const { skip, take, sortBy, sortOrder, isActive } = query;

    const where: FindOptionsWhere<Tag> = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const result = await this.tagRepository.findAndCount({
      where,
      skip,
      take,
      order: sortBy ? { [sortBy]: sortOrder } : { name: SortOrder.ASC },
    });

    return PaginatedResultDto.fromFindAndCount(result, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  /**
   * Get tag by ID (cached for 1 day)
   */
  @Cacheable({
    key: (id: number) => CacheKeys.tag.byId(id),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findById(id: number): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { id } });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    return tag;
  }

  /**
   * Get multiple tags by IDs (cached for 1 day)
   * Used for efficient batch loading in problem queries
   */
  @Cacheable({
    key: (ids: number[]) => CacheKeys.tag.byIds(ids),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findByIds(ids: number[]): Promise<Tag[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    return this.tagRepository.findBy({ id: In(ids) });
  }

  /**
   * Get tag by slug (cached for 1 day)
   */
  @Cacheable({
    key: (slug: string) => CacheKeys.tag.bySlug(slug),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findBySlug(slug: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { slug } });

    if (!tag) {
      throw new NotFoundException(`Tag with slug "${slug}" not found`);
    }

    return tag;
  }

  /**
   * Get tags by type (cached for 1 day)
   */
  @Cacheable({
    key: (type: string) => CacheKeys.tag.byType(type),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findByType(type: string): Promise<Tag[]> {
    return this.tagRepository.find({
      where: { type },
      order: { name: SortOrder.ASC },
    });
  }

  /**
   * Create a new tag (invalidates all tags cache)
   */
  @CacheInvalidate({
    keys: [CacheKeys.tag.all()],
    debug: true,
  })
  @Transactional()
  async create(data: Partial<Tag>): Promise<Tag> {
    // Auto-generate slug from name
    const slug = slugify(data.name || '', {
      lower: true,
      strict: true,
      trim: true,
    });

    // Check for duplicate slug
    const existing = await this.tagRepository.findOne({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(
        `Tag with name "${data.name}" already exists (slug: "${slug}")`,
      );
    }

    const tag = this.tagRepository.create({
      ...data,
      slug,
    });
    return this.tagRepository.save(tag);
  }

  /**
   * Update a tag (invalidates related caches)
   */
  @CacheInvalidate({
    keys: (id: number) => [CacheKeys.tag.all(), CacheKeys.tag.byId(id)],
    debug: true,
  })
  @Transactional()
  async update(id: number, data: Partial<Tag>): Promise<Tag> {
    const tag = await this.findById(id);

    // Auto-generate slug if name is being updated
    let slug = tag.slug;
    if (data.name && data.name !== tag.name) {
      slug = slugify(data.name, {
        lower: true,
        strict: true,
        trim: true,
      });

      // Check for duplicate slug
      const existing = await this.tagRepository.findOne({
        where: { slug },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Tag with name "${data.name}" already exists (slug: "${slug}")`,
        );
      }
    }

    Object.assign(tag, { ...data, slug });
    return this.tagRepository.save(tag);
  }

  /**
   * Delete a tag (invalidates all caches)
   */
  @CacheInvalidate({
    keys: (id: number) => [CacheKeys.tag.all(), CacheKeys.tag.byId(id)],
    debug: true,
  })
  @Transactional()
  async delete(id: number): Promise<void> {
    const tag = await this.findById(id);
    await this.tagRepository.remove(tag);
  }

  /**
   * Get tag count
   */
  async count(): Promise<number> {
    return this.tagRepository.count();
  }
}

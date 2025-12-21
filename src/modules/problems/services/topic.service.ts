import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import slugify from 'slugify';
import { In, Repository } from 'typeorm';

import { Transactional } from 'typeorm-transactional';
import { CACHE_TTL, Cacheable, CacheInvalidate } from '../../../common';
import { CacheKeys } from '../../redis/utils/cache-key.builder';
import { Topic } from '../entities/topic.entity';

@Injectable()
export class TopicService {
  constructor(
    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,
  ) {}

  /**
   * Get all topics (cached for 1 day)
   */
  @Cacheable({
    key: CacheKeys.topic.all(),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findAll(): Promise<Topic[]> {
    return this.topicRepository.find({
      where: { isActive: true },
      order: { orderIndex: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Get all topics including inactive (cached for 1 day)
   */
  @Cacheable({
    key: CacheKeys.topic.allWithInactive(),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findAllWithInactive(): Promise<Topic[]> {
    return this.topicRepository.find({
      order: { orderIndex: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Get topic by ID (cached for 1 day)
   */
  @Cacheable({
    key: (id: number) => CacheKeys.topic.byId(id),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findById(id: number): Promise<Topic> {
    const topic = await this.topicRepository.findOne({ where: { id } });

    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }

    return topic;
  }

  /**
   * Get multiple topics by IDs (cached for 1 day)
   * Used for efficient batch loading in problem queries
   */
  @Cacheable({
    key: (ids: number[]) => CacheKeys.topic.byIds(ids),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findByIds(ids: number[]): Promise<Topic[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    return this.topicRepository.findBy({ id: In(ids) });
  }

  /**
   * Get topic by slug (cached for 1 day)
   */
  @Cacheable({
    key: (slug: string) => CacheKeys.topic.bySlug(slug),
    ttl: CACHE_TTL.ONE_DAY,
    debug: true,
  })
  async findBySlug(slug: string): Promise<Topic> {
    const topic = await this.topicRepository.findOne({ where: { slug } });

    if (!topic) {
      throw new NotFoundException(`Topic with slug "${slug}" not found`);
    }

    return topic;
  }

  /**
   * Create a new topic (invalidates all topics cache)
   */
  @CacheInvalidate({
    keys: [CacheKeys.topic.all()],
    debug: true,
  })
  @Transactional()
  async create(data: Partial<Topic>): Promise<Topic> {
    // Auto-generate slug from name
    const slug = slugify(data.name || '', {
      lower: true,
      strict: true,
      trim: true,
    });

    // Check for duplicate slug
    const existing = await this.topicRepository.findOne({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(
        `Topic with name "${data.name}" already exists (slug: "${slug}")`,
      );
    }

    const topic = this.topicRepository.create({
      ...data,
      slug,
    });
    return this.topicRepository.save(topic);
  }

  /**
   * Update a topic (invalidates related caches)
   */
  @CacheInvalidate({
    keys: (id: number) => [CacheKeys.topic.all(), CacheKeys.topic.byId(id)],
    debug: true,
  })
  @Transactional()
  async update(id: number, data: Partial<Topic>): Promise<Topic> {
    const topic = await this.findById(id);

    // Auto-generate slug if name is being updated
    let slug = topic.slug;
    if (data.name && data.name !== topic.name) {
      slug = slugify(data.name, {
        lower: true,
        strict: true,
        trim: true,
      });

      // Check for duplicate slug
      const existing = await this.topicRepository.findOne({
        where: { slug },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Topic with name "${data.name}" already exists (slug: "${slug}")`,
        );
      }
    }

    Object.assign(topic, { ...data, slug });
    return this.topicRepository.save(topic);
  }

  /**
   * Delete a topic (invalidates all caches)
   */
  @CacheInvalidate({
    keys: (id: number) => [CacheKeys.topic.all(), CacheKeys.topic.byId(id)],
    debug: true,
  })
  @Transactional()
  async delete(id: number): Promise<void> {
    const topic = await this.findById(id);
    await this.topicRepository.remove(topic);
  }

  /**
   * Toggle topic active status (invalidates all caches)
   */
  @CacheInvalidate({
    keys: (id: number) => [CacheKeys.topic.all(), CacheKeys.topic.byId(id)],
    debug: true,
  })
  @Transactional()
  async toggleActive(id: number): Promise<Topic> {
    const topic = await this.findById(id);
    topic.isActive = !topic.isActive;
    return this.topicRepository.save(topic);
  }

  /**
   * Get topic count
   */
  async count(): Promise<number> {
    return this.topicRepository.count({ where: { isActive: true } });
  }

  /**
   * Get total topic count including inactive
   */
  async countAll(): Promise<number> {
    return this.topicRepository.count();
  }
}

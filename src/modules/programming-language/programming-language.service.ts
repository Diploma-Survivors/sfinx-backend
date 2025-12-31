import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import type { Cache } from 'cache-manager';
import slugify from 'slugify';
import { FindOperator, ILike, Repository } from 'typeorm';

import { CACHE_KEYS, CACHE_TTL } from 'src/common/constants/cache.constant';
import {
  Cacheable,
  CacheInvalidate,
} from 'src/common/decorators/cacheable.decorator';
import { PaginatedResultDto } from 'src/common/dto/paginated-result.dto';

import { SortOrder } from 'src/common';
import { Transactional } from 'typeorm-transactional';
import {
  CreateProgrammingLanguageDto,
  QueryProgrammingLanguageDto,
  UpdateProgrammingLanguageDto,
} from './dto';
import { ProgrammingLanguage } from './entities/programming-language.entity';

@Injectable()
export class ProgrammingLanguageService {
  private readonly logger = new Logger(ProgrammingLanguageService.name);

  constructor(
    @InjectRepository(ProgrammingLanguage)
    private readonly languageRepository: Repository<ProgrammingLanguage>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  @Cacheable({
    key: (query: QueryProgrammingLanguageDto) =>
      CACHE_KEYS.PROGRAMMING_LANGUAGES.LIST(
        query.isActive,
        query.search,
        query.page,
        query.limit,
      ),
    ttl: CACHE_TTL.ONE_DAY,
  })
  async findAll(
    query: QueryProgrammingLanguageDto,
  ): Promise<PaginatedResultDto<ProgrammingLanguage>> {
    const { isActive, search } = query;

    // Build query conditions (KISS - simple and clear)
    const where: {
      isActive?: boolean;
      name?: FindOperator<string>;
    } = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    // Execute query with pagination
    const result = await this.languageRepository.findAndCount({
      where,
      order: { orderIndex: SortOrder.ASC, name: SortOrder.ASC },
      skip: query.skip,
      take: query.take,
    });

    return PaginatedResultDto.fromFindAndCount(result, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  /**
   * Get all active programming languages
   * Most frequently accessed endpoint - cached with static key
   */
  @Cacheable({
    key: CACHE_KEYS.PROGRAMMING_LANGUAGES.ALL_ACTIVE,
    ttl: CACHE_TTL.ONE_DAY,
  })
  async findAllActive(): Promise<ProgrammingLanguage[]> {
    return this.languageRepository.find({
      where: { isActive: true },
      order: { orderIndex: SortOrder.ASC, name: SortOrder.ASC },
    });
  }

  /**
   * Get all programming languages without pagination (for admin filters)
   */
  async findAllWithoutPagination(): Promise<ProgrammingLanguage[]> {
    return this.languageRepository.find({
      order: { orderIndex: SortOrder.ASC, name: SortOrder.ASC },
    });
  }

  /**
   * Get programming language by ID
   * Cached per language ID
   */
  @Cacheable({
    key: (id: number) => CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_ID(id),
    ttl: CACHE_TTL.ONE_DAY,
  })
  async findById(id: number): Promise<ProgrammingLanguage> {
    const language = await this.languageRepository.findOne({
      where: { id },
    });

    if (!language) {
      throw new NotFoundException(
        `Programming language with ID ${id} not found`,
      );
    }

    return language;
  }

  /**
   * Get programming language by slug
   * Cached per slug
   */
  @Cacheable({
    key: (slug: string) => CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_SLUG(slug),
    ttl: CACHE_TTL.ONE_DAY,
  })
  async findBySlug(slug: string): Promise<ProgrammingLanguage> {
    const language = await this.languageRepository.findOne({
      where: { slug },
    });

    if (!language) {
      throw new NotFoundException(
        `Programming language with slug "${slug}" not found`,
      );
    }

    return language;
  }

  /**
   * Create a new programming language
   * Invalidates all list caches since a new item affects all lists
   */
  @CacheInvalidate({
    keys: [CACHE_KEYS.PROGRAMMING_LANGUAGES.ALL_ACTIVE],
  })
  @Transactional()
  async create(
    dto: CreateProgrammingLanguageDto,
  ): Promise<ProgrammingLanguage> {
    // Auto-generate slug from name
    const slug = slugify(dto.name, {
      lower: true,
      strict: true,
      trim: true,
    });

    // Check for duplicate name
    const existingByName = await this.languageRepository.findOne({
      where: { name: dto.name },
    });

    if (existingByName) {
      throw new ConflictException(
        `Programming language with name "${dto.name}" already exists`,
      );
    }

    // Check for duplicate slug
    const existingBySlug = await this.languageRepository.findOne({
      where: { slug },
    });

    if (existingBySlug) {
      throw new ConflictException(
        `Programming language with name "${dto.name}" already exists (slug: "${slug}")`,
      );
    }

    // Create and save
    const language = this.languageRepository.create({
      ...dto,
      slug,
    });
    const saved = await this.languageRepository.save(language);

    this.logger.log(
      `Created programming language: ${saved.name} (ID: ${saved.id})`,
    );

    return saved;
  }

  /**
   * Update a programming language
   * Invalidates specific language cache and all list caches
   */
  @CacheInvalidate({
    keys: (id: number) => [
      CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_ID(id),
      CACHE_KEYS.PROGRAMMING_LANGUAGES.ALL_ACTIVE,
    ],
  })
  @Transactional()
  async update(
    id: number,
    dto: UpdateProgrammingLanguageDto,
  ): Promise<ProgrammingLanguage> {
    // Verify language exists
    const language = await this.findById(id);

    // Auto-generate slug if name is being updated
    let slug = language.slug;
    if (dto.name && dto.name !== language.name) {
      slug = slugify(dto.name, {
        lower: true,
        strict: true,
        trim: true,
      });

      // Check for duplicate name
      const existingByName = await this.languageRepository.findOne({
        where: { name: dto.name },
      });

      if (existingByName) {
        throw new ConflictException(
          `Programming language with name "${dto.name}" already exists`,
        );
      }

      // Check for duplicate slug
      const existingBySlug = await this.languageRepository.findOne({
        where: { slug },
      });

      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictException(
          `Programming language with name "${dto.name}" already exists (slug: "${slug}")`,
        );
      }

      // Invalidate old slug cache
      await this.invalidateSlugCache(language.slug);
    }

    // Update and save
    Object.assign(language, { ...dto, slug });
    const updated = await this.languageRepository.save(language);

    this.logger.log(
      `Updated programming language: ${updated.name} (ID: ${updated.id})`,
    );

    return updated;
  }

  /**
   * Delete a programming language (soft delete by setting isActive = false)
   * Invalidates specific language cache and all list caches
   */
  @CacheInvalidate({
    keys: (id: number) => [
      CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_ID(id),
      CACHE_KEYS.PROGRAMMING_LANGUAGES.ALL_ACTIVE,
    ],
  })
  @Transactional()
  async delete(id: number): Promise<void> {
    const language = await this.findById(id);

    // Soft delete by setting isActive to false
    language.isActive = false;
    await this.languageRepository.save(language);

    // Also invalidate slug cache
    await this.invalidateSlugCache(language.slug);

    this.logger.log(
      `Deleted programming language: ${language.name} (ID: ${id})`,
    );
  }

  /**
   * Activate a programming language
   * Invalidates caches since active status affects list queries
   */
  @CacheInvalidate({
    keys: (id: number) => [
      CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_ID(id),
      CACHE_KEYS.PROGRAMMING_LANGUAGES.ALL_ACTIVE,
    ],
  })
  @Transactional()
  async activate(id: number): Promise<ProgrammingLanguage> {
    const language = await this.findById(id);

    if (language.isActive) {
      return language; // Already active, no change needed
    }

    language.isActive = true;
    const updated = await this.languageRepository.save(language);

    // Also invalidate slug cache
    await this.invalidateSlugCache(language.slug);

    this.logger.log(
      `Activated programming language: ${language.name} (ID: ${id})`,
    );

    return updated;
  }

  /**
   * Deactivate a programming language
   * Invalidates caches since active status affects list queries
   */
  @CacheInvalidate({
    keys: (id: number) => [
      CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_ID(id),
      CACHE_KEYS.PROGRAMMING_LANGUAGES.ALL_ACTIVE,
    ],
  })
  @Transactional()
  async deactivate(id: number): Promise<ProgrammingLanguage> {
    const language = await this.findById(id);

    if (!language.isActive) {
      return language; // Already inactive, no change needed
    }

    language.isActive = false;
    const updated = await this.languageRepository.save(language);

    // Also invalidate slug cache
    await this.invalidateSlugCache(language.slug);

    this.logger.log(
      `Deactivated programming language: ${language.name} (ID: ${id})`,
    );

    return updated;
  }

  /**
   * Helper method to invalidate slug cache
   * Private method following KISS principle
   */
  private async invalidateSlugCache(slug: string): Promise<void> {
    // Generate the cache key for the slug
    const cacheKey = CACHE_KEYS.PROGRAMMING_LANGUAGES.BY_SLUG(slug);

    try {
      // Delete the cache entry
      await this.cacheManager.del(cacheKey);

      this.logger.debug(
        `🗑️ Cache invalidated for slug: "${slug}" (key: "${cacheKey}")`,
      );
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      this.logger.error(
        `Failed to invalidate cache for slug: "${slug}" (key: "${cacheKey}")`,
        (error as Error).stack,
      );
    }
  }
}

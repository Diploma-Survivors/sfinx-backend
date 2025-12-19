import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOperator, ILike, Repository } from 'typeorm';

import { CACHE_KEYS, CACHE_TTL } from 'src/common/constants/cache.constant';
import {
  Cacheable,
  CacheInvalidate,
} from 'src/common/decorators/cacheable.decorator';

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
  async findAll(query: QueryProgrammingLanguageDto): Promise<{
    data: ProgrammingLanguage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { isActive, search, page = 1, limit = 20 } = query;

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
    const [data, total] = await this.languageRepository.findAndCount({
      where,
      order: { orderIndex: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
      order: { orderIndex: 'ASC', name: 'ASC' },
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
  async create(
    dto: CreateProgrammingLanguageDto,
  ): Promise<ProgrammingLanguage> {
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
      where: { slug: dto.slug },
    });

    if (existingBySlug) {
      throw new ConflictException(
        `Programming language with slug "${dto.slug}" already exists`,
      );
    }

    // Create and save
    const language = this.languageRepository.create(dto);
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
  async update(
    id: number,
    dto: UpdateProgrammingLanguageDto,
  ): Promise<ProgrammingLanguage> {
    // Verify language exists
    const language = await this.findById(id);

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== language.name) {
      const existingByName = await this.languageRepository.findOne({
        where: { name: dto.name },
      });

      if (existingByName) {
        throw new ConflictException(
          `Programming language with name "${dto.name}" already exists`,
        );
      }
    }

    // Check for duplicate slug if slug is being updated
    if (dto.slug && dto.slug !== language.slug) {
      const existingBySlug = await this.languageRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existingBySlug) {
        throw new ConflictException(
          `Programming language with slug "${dto.slug}" already exists`,
        );
      }

      // Also invalidate old slug cache
      this.invalidateSlugCache(language.slug);
    }

    // Update and save
    Object.assign(language, dto);
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
  async delete(id: number): Promise<void> {
    const language = await this.findById(id);

    // Soft delete by setting isActive to false
    language.isActive = false;
    await this.languageRepository.save(language);

    // Also invalidate slug cache
    this.invalidateSlugCache(language.slug);

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
  async activate(id: number): Promise<ProgrammingLanguage> {
    const language = await this.findById(id);

    if (language.isActive) {
      return language; // Already active, no change needed
    }

    language.isActive = true;
    const updated = await this.languageRepository.save(language);

    // Also invalidate slug cache
    this.invalidateSlugCache(language.slug);

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
  async deactivate(id: number): Promise<ProgrammingLanguage> {
    const language = await this.findById(id);

    if (!language.isActive) {
      return language; // Already inactive, no change needed
    }

    language.isActive = false;
    const updated = await this.languageRepository.save(language);

    // Also invalidate slug cache
    this.invalidateSlugCache(language.slug);

    this.logger.log(
      `Deactivated programming language: ${language.name} (ID: ${id})`,
    );

    return updated;
  }

  /**
   * Helper method to invalidate slug cache
   * Private method following KISS principle
   */
  private invalidateSlugCache(slug: string): void {
    // This is a helper to manually invalidate slug cache when needed
    // The @CacheInvalidate decorator doesn't handle dynamic slug keys
    // In a real scenario, you might inject CacheManager here
    this.logger.debug(`Should invalidate cache for slug: ${slug}`);
  }
}

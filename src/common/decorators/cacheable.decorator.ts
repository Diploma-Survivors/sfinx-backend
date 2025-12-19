import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Logger } from '@nestjs/common';

import type { Cache } from 'cache-manager';

/**
 * Options for the Cacheable decorator
 */
export interface CacheableOptions {
  /**
   * Cache key or function to generate cache key
   * If function, receives method arguments
   */
  key: string | ((...args: any[]) => string);

  /**
   * Time to live in seconds
   */
  ttl: number;

  /**
   * Whether to cache null/undefined values
   * @default false
   */
  cacheNullable?: boolean;

  /**
   * Enable debug logging for cache operations
   * @default false
   */
  debug?: boolean;
}

/**
 * Method decorator that caches the result of the decorated method
 *
 * @param options - Caching options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Cacheable({
 *   key: 'languages:all',
 *   ttl: CACHE_TTL.ONE_DAY,
 *   debug: true, // Enable cache logging
 * })
 * async findAll(): Promise<Language[]> {
 *   return this.repository.find();
 * }
 *
 * @Cacheable({
 *   key: (id: number) => `problem:${id}`,
 *   ttl: CACHE_TTL.FIFTEEN_MINUTES,
 * })
 * async findById(id: number): Promise<Problem> {
 *   return this.repository.findOne({ where: { id } });
 * }
 * ```
 */
export function Cacheable(options: CacheableOptions): MethodDecorator {
  const injectCache = Inject(CACHE_MANAGER);

  return (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    injectCache(target, 'cacheManager');

    const logger = new Logger(
      `Cacheable:${target.constructor.name}.${propertyKey}`,
    );

    const originalMethod = descriptor.value as (...args: any[]) => Promise<any>;

    descriptor.value = async function (...args: any[]) {
      const cacheManager = (this as { cacheManager: Cache }).cacheManager;

      if (!cacheManager) {
        logger.warn(
          'Cache manager not available, executing method without cache',
        );
        // If cache manager not available, execute method normally
        return originalMethod.apply(this, args) as unknown;
      }

      // Generate cache key
      const cacheKey =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        typeof options.key === 'function' ? options.key(...args) : options.key;

      const startTime = Date.now();

      try {
        // Try to get from cache
        const cachedValue = await cacheManager.get(cacheKey);

        if (cachedValue !== undefined) {
          const duration = Date.now() - startTime;

          logger.log(
            `✅ CACHE HIT | Key: "${cacheKey}" | Duration: ${duration}ms | Type: ${typeof cachedValue}`,
          );

          if (options.debug) {
            logger.debug(
              `Cache hit details - Key: "${cacheKey}", Value: ${JSON.stringify(cachedValue).substring(0, 100)}...`,
            );
          }

          return cachedValue;
        }

        // Cache miss
        const missTime = Date.now() - startTime;
        logger.log(
          `❌ CACHE MISS | Key: "${cacheKey}" | Lookup Duration: ${missTime}ms | Executing method...`,
        );

        // Execute original method
        const methodStartTime = Date.now();
        const result = (await originalMethod.apply(this, args)) as unknown;
        const methodDuration = Date.now() - methodStartTime;

        // Cache the result if not nullable or cacheNullable is true
        const shouldCache =
          (result !== null && result !== undefined) || options.cacheNullable;

        if (shouldCache) {
          await cacheManager.set(cacheKey, result, options.ttl * 1000);

          const totalDuration = Date.now() - startTime;
          logger.log(
            `💾 CACHE SET | Key: "${cacheKey}" | TTL: ${options.ttl}s | Method: ${methodDuration}ms | Total: ${totalDuration}ms`,
          );

          if (options.debug) {
            logger.debug(
              `Cache set details - Key: "${cacheKey}", TTL: ${options.ttl}s, Result size: ${JSON.stringify(result).length} bytes`,
            );
          }
        } else {
          logger.warn(
            `⚠️ CACHE SKIP | Key: "${cacheKey}" | Reason: Result is ${result === null ? 'null' : 'undefined'} and cacheNullable is false`,
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error(
          `🔥 CACHE ERROR | Key: "${cacheKey}" | Duration: ${duration}ms | Error: ${(error as Error).message}`,
          (error as Error).stack,
        );

        // If cache fails, execute method normally
        return originalMethod.apply(this, args) as unknown;
      }
    };

    return descriptor;
  };
}

/**
 * Options for cache invalidation
 */
export interface CacheInvalidateOptions {
  /**
   * Cache key(s) to invalidate
   * Can be string, array of strings, or function that returns key(s)
   */
  keys: string | string[] | ((...args: any[]) => string | string[]);

  /**
   * Enable debug logging for cache invalidation
   * @default false
   */
  debug?: boolean;
}

/**
 * Method decorator that invalidates cache keys after method execution
 *
 * @param options - Cache invalidation options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @CacheInvalidate({
 *   keys: ['languages:all'],
 *   debug: true, // Enable invalidation logging
 * })
 * async create(data: CreateLanguageDto): Promise<Language> {
 *   return this.repository.save(data);
 * }
 *
 * @CacheInvalidate({
 *   keys: (id: number) => [`problem:${id}`, 'problems:list']
 * })
 * async update(id: number, data: UpdateProblemDto): Promise<void> {
 *   await this.repository.update(id, data);
 * }
 * ```
 */
export function CacheInvalidate(options: CacheInvalidateOptions) {
  const injectCache = Inject(CACHE_MANAGER);

  return (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    // Inject cache manager
    injectCache(target, 'cacheManager');

    const logger = new Logger(
      `CacheInvalidate:${target.constructor.name}.${propertyKey}`,
    );

    const originalMethod = descriptor.value as (...args: any[]) => Promise<any>;

    descriptor.value = async function (...args: any[]) {
      const cacheManager = (this as { cacheManager: Cache }).cacheManager;

      // Execute original method
      const methodStartTime = Date.now();
      const result = (await originalMethod.apply(this, args)) as unknown;
      const methodDuration = Date.now() - methodStartTime;

      if (cacheManager) {
        const invalidationStartTime = Date.now();

        try {
          // Generate keys to invalidate
          let keysToInvalidate: string[];

          if (typeof options.keys === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const keys = options.keys(...args);
            keysToInvalidate = Array.isArray(keys) ? keys : [keys];
          } else if (Array.isArray(options.keys)) {
            keysToInvalidate = options.keys;
          } else {
            keysToInvalidate = [options.keys];
          }

          logger.log(
            `🗑️ CACHE INVALIDATE START | Keys: [${keysToInvalidate.join(', ')}] | Count: ${keysToInvalidate.length}`,
          );

          if (options.debug) {
            logger.debug(
              `Invalidating keys: ${JSON.stringify(keysToInvalidate)}`,
            );
          }

          // Invalidate all keys
          await Promise.all(
            keysToInvalidate.map((key) => cacheManager.del(key)),
          );

          const invalidationDuration = Date.now() - invalidationStartTime;
          const totalDuration = methodDuration + invalidationDuration;

          logger.log(
            `✅ CACHE INVALIDATE SUCCESS | Keys: ${keysToInvalidate.length} | Invalidation: ${invalidationDuration}ms | Method: ${methodDuration}ms | Total: ${totalDuration}ms`,
          );
        } catch (error) {
          const invalidationDuration = Date.now() - invalidationStartTime;

          logger.error(
            `🔥 CACHE INVALIDATE ERROR | Duration: ${invalidationDuration}ms | Error: ${(error as Error).message}`,
            (error as Error).stack,
          );
        }
      } else {
        logger.warn('Cache manager not available, skipping invalidation');
      }

      return result;
    };

    return descriptor;
  };
}

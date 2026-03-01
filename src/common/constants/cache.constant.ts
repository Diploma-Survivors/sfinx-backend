/**
 * Redis TTL constants for caching
 */
export const CACHE_TTL = {
  /**
   * One month in seconds - for data that changes extremely rarely
   */
  ONE_MONTH: 2592000,

  /**
   * One day in seconds - for static data like languages, tags, topics
   */
  ONE_DAY: 86400,

  /**
   * One hour in seconds - for semi-static data
   */
  ONE_HOUR: 3600,

  /**
   * Fifteen minutes in seconds - for semi-static data like problem details
   */
  FIFTEEN_MINUTES: 900,

  /**
   * Five minutes in seconds - for dynamic data like statistics
   */
  FIVE_MINUTES: 300,

  /**
   * One minute in seconds - for highly dynamic data
   */
  ONE_MINUTE: 60,
} as const;

/**
 * Cache key patterns for different modules
 */
export const CACHE_KEYS = {
  /**
   * Programming language cache keys
   */
  PROGRAMMING_LANGUAGES: {
    /**
     * All active languages (most frequently accessed)
     */
    ALL_ACTIVE: 'languages:all:active',

    /**
     * All languages with filters
     * Pattern: languages:list:{isActive}:{search}:{page}:{limit}
     */
    LIST: (
      isActive?: boolean,
      search?: string,
      page: number = 1,
      limit: number = 20,
    ) =>
      `languages:list:${isActive ?? 'all'}:${search ?? 'none'}:${page}:${limit}`,

    /**
     * Single language by ID
     * Pattern: language:{id}
     */
    BY_ID: (id: number) => `language:${id}`,

    /**
     * Single language by slug
     * Pattern: language:slug:{slug}
     */
    BY_SLUG: (slug: string) => `language:slug:${slug}`,
  },
} as const;

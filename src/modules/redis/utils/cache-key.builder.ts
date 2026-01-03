/**
 * Fluent API for building Redis cache keys
 *
 * Provides a type-safe, chainable interface for constructing
 * consistent cache keys across the application.
 *
 * @example
 * ```typescript
 * const key = CacheKeyBuilder
 *   .namespace('users')
 *   .entity('profile')
 *   .id(userId)
 *   .suffix('details')
 *   .build(); // "users:profile:123:details"
 * ```
 */
export class CacheKeyBuilder {
  private parts: string[] = [];

  private constructor() {}

  /**
   * Create a new cache key builder
   */
  static create(): CacheKeyBuilder {
    return new CacheKeyBuilder();
  }

  /**
   * Start with a namespace
   */
  static namespace(namespace: string): CacheKeyBuilder {
    return new CacheKeyBuilder().namespace(namespace);
  }

  /**
   * Add a namespace part
   */
  namespace(namespace: string): this {
    this.parts.push(namespace);
    return this;
  }

  /**
   * Add an entity type
   */
  entity(entity: string): this {
    this.parts.push(entity);
    return this;
  }

  /**
   * Add an ID
   */
  id(id: string | number): this {
    this.parts.push(String(id));
    return this;
  }

  /**
   * Add a suffix
   */
  suffix(suffix: string): this {
    this.parts.push(suffix);
    return this;
  }

  /**
   * Add a custom part
   */
  part(part: string): this {
    this.parts.push(part);
    return this;
  }

  /**
   * Add multiple parts
   */
  addParts(...partsList: (string | number)[]): this {
    this.parts.push(...partsList.map(String));
    return this;
  }

  /**
   * Build the final key
   */
  build(): string {
    return this.parts.join(':');
  }

  /**
   * Build a pattern for matching keys
   */
  buildPattern(): string {
    return this.parts.join(':') + ':*';
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.parts = [];
    return this;
  }
}

/**
 * Predefined key builders for common patterns
 */
export class CacheKeys {
  /**
   * User-related cache keys
   */
  static user = {
    profile: (userId: string | number) =>
      CacheKeyBuilder.namespace('user').id(userId).suffix('profile').build(),

    settings: (userId: string | number) =>
      CacheKeyBuilder.namespace('user').id(userId).suffix('settings').build(),

    sessions: (userId: string | number) =>
      CacheKeyBuilder.namespace('user').id(userId).suffix('sessions').build(),

    statistics: (userId: string | number) =>
      CacheKeyBuilder.namespace('user').id(userId).suffix('statistics').build(),
  };

  /**
   * Problem-related cache keys
   */
  static problem = {
    detail: (problemId: string | number) =>
      CacheKeyBuilder.namespace('problem')
        .id(problemId)
        .suffix('detail')
        .build(),

    bySlug: (slug: string) =>
      CacheKeyBuilder.namespace('problem').suffix('slug').part(slug).build(),

    testcases: (problemId: string | number) =>
      CacheKeyBuilder.namespace('problem')
        .id(problemId)
        .suffix('testcases')
        .build(),

    samples: (problemId: string | number) =>
      CacheKeyBuilder.namespace('problem')
        .id(problemId)
        .suffix('samples')
        .build(),

    list: (filters: Record<string, any>) => {
      const builder = CacheKeyBuilder.namespace('problem').suffix('list');
      Object.entries(filters).forEach(([key, value]) => {
        builder.part(`${key}:${value}`);
      });
      return builder.build();
    },
  };

  /**
   * Submission-related cache keys
   */
  static submission = {
    detail: (submissionId: string | number) =>
      CacheKeyBuilder.namespace('submission')
        .id(submissionId)
        .suffix('detail')
        .build(),

    userSubmissions: (userId: string | number, problemId?: string | number) => {
      const builder = CacheKeyBuilder.namespace('submission')
        .suffix('user')
        .id(userId);
      if (problemId) {
        builder.suffix('problem').id(problemId);
      }
      return builder.build();
    },

    progress: (userId: string | number, problemId: string | number) =>
      CacheKeyBuilder.namespace('submission')
        .suffix('progress')
        .part(`user:${userId}`)
        .part(`problem:${problemId}`)
        .build(),
  };

  /**
   * Judge0 submission tracking keys
   * Used for managing async submission results from Judge0 callbacks
   */
  static judge0 = {
    /**
     * Metadata key for submission (total testcases, received count, problemId)
     */
    meta: (submissionId: string) =>
      CacheKeyBuilder.namespace('judge:sub')
        .id(submissionId)
        .suffix('meta')
        .build(),

    /**
     * Results by index (hash of index -> result JSON)
     */
    resultsByIndex: (submissionId: string) =>
      CacheKeyBuilder.namespace('judge:sub')
        .id(submissionId)
        .suffix('resultsI')
        .build(),

    /**
     * Set of handled token IDs to prevent duplicate processing
     */
    seen: (submissionId: string) =>
      CacheKeyBuilder.namespace('judge:sub')
        .id(submissionId)
        .suffix('seen')
        .build(),

    /**
     * Lock to ensure finalize runs only once
     */
    doneLock: (submissionId: string) =>
      CacheKeyBuilder.namespace('judge:sub')
        .id(submissionId)
        .suffix('done:lock')
        .build(),
  };

  /**
   * Language-related cache keys
   */
  static language = {
    all: () => CacheKeyBuilder.namespace('language').suffix('all').build(),

    active: () =>
      CacheKeyBuilder.namespace('language').suffix('active').build(),

    byId: (languageId: string | number) =>
      CacheKeyBuilder.namespace('language').id(languageId).build(),

    bySlug: (slug: string) =>
      CacheKeyBuilder.namespace('language').suffix('slug').part(slug).build(),
  };

  /**
   * Topic-related cache keys
   */
  static topic = {
    all: () => CacheKeyBuilder.namespace('topic').suffix('all').build(),

    allWithInactive: () =>
      CacheKeyBuilder.namespace('topic').suffix('all:with-inactive').build(),

    byId: (topicId: string | number) =>
      CacheKeyBuilder.namespace('topic').id(topicId).build(),

    byIds: (ids: number[]) =>
      CacheKeyBuilder.namespace('topic')
        .suffix('ids')
        .part(ids.sort().join(','))
        .build(),

    bySlug: (slug: string) =>
      CacheKeyBuilder.namespace('topic').suffix('slug').part(slug).build(),
  };

  /**
   * Tag-related cache keys
   */
  static tag = {
    all: () => CacheKeyBuilder.namespace('tag').suffix('all').build(),

    byId: (tagId: string | number) =>
      CacheKeyBuilder.namespace('tag').id(tagId).build(),

    byIds: (ids: number[]) =>
      CacheKeyBuilder.namespace('tag')
        .suffix('ids')
        .part(ids.sort().join(','))
        .build(),

    bySlug: (slug: string) =>
      CacheKeyBuilder.namespace('tag').suffix('slug').part(slug).build(),

    byType: (type: string) =>
      CacheKeyBuilder.namespace('tag').suffix('type').part(type).build(),
  };

  /**
   * Contest-related cache keys
   */
  static contest = {
    detail: (contestId: string | number) =>
      CacheKeyBuilder.namespace('contest')
        .id(contestId)
        .suffix('detail')
        .build(),

    bySlug: (slug: string) =>
      CacheKeyBuilder.namespace('contest').suffix('slug').part(slug).build(),

    problems: (contestId: string | number) =>
      CacheKeyBuilder.namespace('contest')
        .id(contestId)
        .suffix('problems')
        .build(),

    leaderboard: (
      contestId: string | number,
      page: number,
      limit: number,
      search?: string,
    ) => {
      const builder = CacheKeyBuilder.namespace('contest')
        .id(contestId)
        .suffix('leaderboard')
        .part(`p${page}`)
        .part(`l${limit}`);

      if (search) {
        builder.part(`s:${search}`);
      }

      return builder.build();
    },

    leaderboardPattern: (contestId: string | number) =>
      CacheKeyBuilder.namespace('contest')
        .id(contestId)
        .suffix('leaderboard')
        .buildPattern(),

    participant: (contestId: string | number, userId: string | number) =>
      CacheKeyBuilder.namespace('contest')
        .id(contestId)
        .suffix('participant')
        .id(userId)
        .build(),

    participantCount: (contestId: string | number) =>
      CacheKeyBuilder.namespace('contest')
        .id(contestId)
        .suffix('participant-count')
        .build(),

    list: (filters: Record<string, unknown>) => {
      const builder = CacheKeyBuilder.namespace('contest').suffix('list');
      Object.entries(filters).forEach(([key, value]) => {
        builder.part(`${key}:${String(value)}`);
      });
      return builder.build();
    },
  };
}

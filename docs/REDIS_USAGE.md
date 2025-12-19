# Redis Module Usage Examples

This document provides practical examples of using the Redis module in your NestJS application.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Using RedisService (ioredis)](#using-redisservice-ioredis)
- [Using CacheService](#using-cacheservice)
- [Using LockService](#using-lockservice)
- [Using RateLimiterService](#using-ratelimiterservice)
- [Using PubSubService](#using-pubsubservice)
- [Lua Scripts](#lua-scripts)
- [Cache Key Builder](#cache-key-builder)

## Basic Setup

The Redis module is already registered globally in `app.module.ts`, so you can inject any Redis service into your controllers or services.

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService, CacheService } from 'src/modules/redis';

@Injectable()
export class YourService {
  constructor(
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
  ) {}
}
```

## Using RedisService (ioredis)

The `RedisService` provides direct access to ioredis for advanced operations.

### Basic Operations

```typescript
// Get/Set
await this.redisService.set('user:123', 'John Doe', 3600); // TTL: 1 hour
const value = await this.redisService.get('user:123');

// Delete
await this.redisService.del('user:123');

// Check existence
const exists = await this.redisService.exists('user:123');

// Increment/Decrement
await this.redisService.incr('page:views');
await this.redisService.incrby('score', 10);
await this.redisService.decr('inventory');
```

### Hash Operations

```typescript
// Set hash field
await this.redisService.hset('user:123', 'name', 'John Doe');

// Get hash field
const name = await this.redisService.hget('user:123', 'name');

// Get all hash fields
const user = await this.redisService.hgetall('user:123');

// Delete hash field
await this.redisService.hdel('user:123', 'name');
```

### Set Operations

```typescript
// Add to set
await this.redisService.sadd('user:123:tags', ['typescript', 'nestjs']);

// Get all set members
const tags = await this.redisService.smembers('user:123:tags');

// Remove from set
await this.redisService.srem('user:123:tags', 'typescript');
```

### List Operations

```typescript
// Push to list
await this.redisService.rpush('queue:tasks', 'task1');

// Pop from list
const task = await this.redisService.lpop('queue:tasks');

// Get range
const tasks = await this.redisService.lrange('queue:tasks', 0, 9);
```

### Scanning Keys (Production-Safe)

```typescript
// Scan with pattern
let cursor = '0';
const allKeys: string[] = [];

do {
  const result = await this.redisService.scan(cursor, 'user:*', 100);
  cursor = result.cursor;
  allKeys.push(...result.keys);
} while (cursor !== '0');

// Delete by pattern
const deleted = await this.redisService.deleteByPattern('cache:user:*');
```

## Using CacheService

The `CacheService` provides high-level caching with automatic JSON serialization.

### Basic Caching

```typescript
// Set cache
await this.cacheService.set(
  'user:123',
  { name: 'John', age: 30 },
  { ttl: 3600 },
);

// Get cache
const user = await this.cacheService.get<User>('user:123');

// Cache-aside pattern
const user = await this.cacheService.getOrSet(
  'user:123',
  async () => {
    // This function is only called if cache miss
    return await this.userRepository.findOne(123);
  },
  { ttl: 3600 },
);
```

### Cache Invalidation

```typescript
// Invalidate single key
await this.cacheService.invalidate('user:123');

// Invalidate multiple keys
await this.cacheService.invalidate(['user:123', 'user:456']);

// Invalidate by pattern
await this.cacheService.invalidateByPattern('user:*');

// Tag-based invalidation
await this.cacheService.set('user:123', userData, {
  ttl: 3600,
  tags: ['user', 'profile'],
});
await this.cacheService.invalidateByTags(['profile']); // Invalidates all caches with 'profile' tag
```

### Batch Operations

```typescript
// Get multiple
const users = await this.cacheService.mget<User>(['user:123', 'user:456']);

// Set multiple
await this.cacheService.mset([
  { key: 'user:123', value: user1, ttl: 3600 },
  { key: 'user:456', value: user2, ttl: 3600 },
]);
```

## Using LockService

Distributed locking for preventing race conditions.

### Basic Locking

```typescript
// Acquire lock
const lock = await this.lockService.acquire('resource:123', {
  ttl: 10000, // 10 seconds
  retryCount: 3,
  retryDelay: 100,
});

if (lock.acquired) {
  try {
    // Do critical work
    await this.updateResource(123);
  } finally {
    // Always release the lock
    await this.lockService.release('resource:123', lock.identifier!);
  }
}
```

### Using withLock Helper

```typescript
// Automatically acquires and releases lock
const result = await this.lockService.withLock(
  'resource:123',
  async () => {
    // Your critical section code
    return await this.updateResource(123);
  },
  { ttl: 10000 },
);
```

### Lock Extension

```typescript
const lock = await this.lockService.acquire('long:task');

if (lock.acquired) {
  // Extend lock if task takes longer
  await this.lockService.extend('long:task', lock.identifier!, 10000);

  // Do more work...

  await this.lockService.release('long:task', lock.identifier!);
}
```

## Using RateLimiterService

Distributed rate limiting with multiple algorithms.

### Sliding Window Rate Limiting

```typescript
const result = await this.rateLimiterService.checkLimit(
  `user:${userId}`,
  10, // limit
  60, // window in seconds
  'api:calls', // optional action
);

if (!result.allowed) {
  throw new TooManyRequestsException(
    `Rate limit exceeded. Retry after ${result.retryAfter} seconds`,
  );
}

// Continue processing...
```

### Simple Fixed Window

```typescript
const result = await this.rateLimiterService.checkSimpleLimit(
  `ip:${ipAddress}`,
  100, // limit
  3600, // 1 hour window
);
```

### Token Bucket (for Burst Handling)

```typescript
const result = await this.rateLimiterService.checkTokenBucket(
  `user:${userId}`,
  10, // capacity
  1, // refill rate
  1, // refill interval (seconds)
  'downloads',
);
```

### Rate Limit Info

```typescript
// Get remaining requests
const remaining = await this.rateLimiterService.getRemaining(
  `user:${userId}`,
  10,
  60,
);

// Get reset time
const resetTime = await this.rateLimiterService.getResetTime(`user:${userId}`);

// Reset limit
await this.rateLimiterService.reset(`user:${userId}`);
```

## Using PubSubService

Real-time messaging across distributed instances.

### Basic Pub/Sub

```typescript
// Subscribe to channel
await this.pubSubService.subscribe('user:events', async (channel, message) => {
  console.log(`Received on ${channel}:`, message);
  // Handle message
});

// Publish message
await this.pubSubService.publish('user:events', {
  type: 'user:created',
  userId: 123,
});

// Unsubscribe
await this.pubSubService.unsubscribe('user:events');
```

### Pattern Subscriptions

```typescript
// Subscribe to pattern
await this.pubSubService.psubscribe(
  'user:*',
  async (pattern, channel, message) => {
    console.log(`Pattern ${pattern} matched channel ${channel}:`, message);
  },
);

// Publish to specific channel
await this.pubSubService.publish('user:created', { userId: 123 });
await this.pubSubService.publish('user:updated', { userId: 123 });
```

### Typed Events

```typescript
interface UserCreatedEvent {
  userId: number;
  email: string;
}

// Subscribe to typed event
await this.pubSubService.subscribeToEvent<UserCreatedEvent>(
  'user:events',
  'user:created',
  async (data) => {
    console.log('User created:', data.userId, data.email);
  },
);

// Publish typed event
await this.pubSubService.publishEvent<UserCreatedEvent>(
  'user:events',
  'user:created',
  { userId: 123, email: 'user@example.com' },
);
```

## Lua Scripts

Execute Lua scripts for atomic operations.

### Loading and Executing Scripts

```typescript
// Define script
const incrementScript = {
  name: 'increment_if_exists',
  numberOfKeys: 1,
  script: `
    if redis.call("exists", KEYS[1]) == 1 then
      return redis.call("incr", KEYS[1])
    else
      return nil
    end
  `,
};

// Load script
const sha = await this.redisService.loadScript(incrementScript);

// Execute loaded script
const result = await this.redisService.evalsha(
  'increment_if_exists',
  ['counter:123'],
  [],
);

// Or execute directly
const result2 = await this.redisService.eval(
  incrementScript.script,
  ['counter:123'],
  [],
);
```

### Advanced Lua Example: Rate Limiting

```typescript
const rateLimitScript = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local current = tonumber(redis.call('get', key) or "0")
  
  if current < limit then
    redis.call('incr', key)
    if current == 0 then
      redis.call('expire', key, window)
    end
    return 1
  else
    return 0
  end
`;

const allowed = await this.redisService.eval(
  rateLimitScript,
  ['ratelimit:user:123'],
  [10, 60], // 10 requests per 60 seconds
);
```

## Cache Key Builder

Build consistent cache keys using the fluent API.

### Basic Usage

```typescript
import { CacheKeyBuilder, CacheKeys } from 'src/modules/redis';

// Using builder
const key = CacheKeyBuilder.namespace('users')
  .entity('profile')
  .id(userId)
  .suffix('details')
  .build(); // "users:profile:123:details"

// Build pattern
const pattern = CacheKeyBuilder.namespace('users')
  .entity('profile')
  .buildPattern(); // "users:profile:*"
```

### Using Predefined Keys

```typescript
// User keys
const profileKey = CacheKeys.user.profile(userId);
const settingsKey = CacheKeys.user.settings(userId);
const statsKey = CacheKeys.user.statistics(userId);

// Problem keys
const problemKey = CacheKeys.problem.detail(problemId);
const slugKey = CacheKeys.problem.bySlug('two-sum');
const listKey = CacheKeys.problem.list({ difficulty: 'easy', page: 1 });

// Language keys
const allLanguages = CacheKeys.language.all();
const activeLanguages = CacheKeys.language.active();
const languageById = CacheKeys.language.byId(languageId);
```

## Real-World Example: Caching User Profile

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly lockService: LockService,
    private readonly userRepository: Repository<User>,
  ) {}

  async getUserProfile(userId: number): Promise<User> {
    const cacheKey = CacheKeys.user.profile(userId);

    // Try cache first
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        // Cache miss - fetch from database
        return await this.userRepository.findOne({ where: { id: userId } });
      },
      { ttl: CACHE_TTL.ONE_HOUR, tags: ['user', 'profile'] },
    );
  }

  async updateUserProfile(userId: number, data: UpdateUserDto): Promise<User> {
    // Use lock to prevent concurrent updates
    return await this.lockService.withLock(
      `user:update:${userId}`,
      async () => {
        const user = await this.userRepository.update(userId, data);

        // Invalidate cache
        await this.cacheService.invalidate(CacheKeys.user.profile(userId));

        // Or invalidate by tag
        await this.cacheService.invalidateByTags(['profile']);

        return user;
      },
      { ttl: 5000 },
    );
  }
}
```

## Health Checks

```typescript
@Injectable()
export class HealthService {
  constructor(private readonly redisHealth: RedisHealthIndicator) {}

  async checkRedis() {
    const status = await this.redisHealth.getHealthStatus();
    return status;
  }
}
```

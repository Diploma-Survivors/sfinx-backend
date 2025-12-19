# Redis Decorators Usage Guide

## Overview

The Redis module provides two powerful decorators for automatic caching:

- `@Cacheable` - Automatically caches method results
- `@CacheInvalidate` - Automatically invalidates cache after method execution

## Setup

The decorators work with interceptors that need to be applied to your controllers or methods.

### Method 1: Apply to Specific Methods

```typescript
import { Controller, Get, Put, UseInterceptors } from '@nestjs/common';
import {
  Cacheable,
  CacheInvalidate,
  CacheableInterceptor,
  CacheInvalidateInterceptor,
  CACHE_TTL,
} from 'src/modules/redis';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Apply interceptor and decorator to specific method
  @Get(':id')
  @UseInterceptors(CacheableInterceptor)
  @Cacheable({ ttl: CACHE_TTL.ONE_HOUR, prefix: 'user' })
  async getUser(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Put(':id')
  @UseInterceptors(CacheInvalidateInterceptor)
  @CacheInvalidate({ patterns: ['user:*'] })
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return await this.userService.update(id, data);
  }
}
```

### Method 2: Apply to Entire Controller

```typescript
import { Controller, Get, Put, UseInterceptors } from '@nestjs/common';
import {
  Cacheable,
  CacheInvalidate,
  CacheableInterceptor,
  CacheInvalidateInterceptor,
} from 'src/modules/redis';

// Apply interceptors to all methods in controller
@Controller('users')
@UseInterceptors(CacheableInterceptor, CacheInvalidateInterceptor)
export class UserController {
  @Get(':id')
  @Cacheable({ ttl: 3600 })
  async getUser(@Param('id') id: string) {
    // Automatically cached
  }

  @Put(':id')
  @CacheInvalidate({ patterns: ['user:*'] })
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    // Cache automatically invalidated after execution
  }
}
```

### Method 3: Global Interceptors (Not Recommended)

You can also register interceptors globally in `app.module.ts`, but this is not recommended as it will apply caching to all methods:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  CacheableInterceptor,
  CacheInvalidateInterceptor,
} from 'src/modules/redis';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheableInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInvalidateInterceptor,
    },
  ],
})
export class AppModule {}
```

## @Cacheable Decorator

### Basic Usage

```typescript
@Get('profile')
@UseInterceptors(CacheableInterceptor)
@Cacheable({ ttl: 3600 }) // Cache for 1 hour
async getProfile(@Param('id') userId: string) {
  return await this.userService.getProfile(userId);
}
```

### With Custom Prefix

```typescript
@Cacheable({ ttl: 3600, prefix: 'user:profile' })
async getProfile(@Param('id') userId: string) {
  // Cache key will be: user:profile:UserController:getProfile:{args}
}
```

### With Tags for Invalidation

```typescript
@Cacheable({
  ttl: 3600,
  tags: ['user', 'profile']
})
async getProfile(@Param('id') userId: string) {
  // Can be invalidated later using tags
}
```

### With Custom Key Generator

```typescript
@Cacheable({
  ttl: 3600,
  keyGenerator: (req, userId: string) => `user:${userId}:profile`,
})
async getProfile(@Param('id') userId: string) {
  // Uses custom cache key: user:123:profile
}
```

### Complete Example

```typescript
@Controller('problems')
@UseInterceptors(CacheableInterceptor)
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get()
  @Cacheable({
    ttl: CACHE_TTL.FIFTEEN_MINUTES,
    prefix: 'problems',
    tags: ['problems', 'list'],
  })
  async findAll(@Query() query: FindProblemsDto) {
    return await this.problemsService.findAll(query);
  }

  @Get(':id')
  @Cacheable({
    ttl: CACHE_TTL.ONE_HOUR,
    keyGenerator: (req, id: string) => `problem:${id}`,
    tags: ['problem', 'detail'],
  })
  async findOne(@Param('id') id: string) {
    return await this.problemsService.findOne(id);
  }
}
```

## @CacheInvalidate Decorator

### Invalidate by Keys

```typescript
@Put(':id')
@UseInterceptors(CacheInvalidateInterceptor)
@CacheInvalidate({ keys: ['user:123:profile'] })
async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
  return await this.userService.update(id, data);
}
```

### Invalidate by Patterns

```typescript
@Put(':id')
@CacheInvalidate({ patterns: ['user:*:profile', 'user:*:settings'] })
async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
  // Invalidates all user profile and settings caches
}
```

### Invalidate by Tags

```typescript
@Put(':id')
@CacheInvalidate({ tags: ['user', 'profile'] })
async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
  // Invalidates all caches tagged with 'user' or 'profile'
}
```

### With Custom Key Generator

```typescript
@Put(':id')
@CacheInvalidate({
  keyGenerator: (req, id: string) => [`user:${id}:profile`, `user:${id}:settings`],
})
async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
  // Dynamically generates keys to invalidate based on parameters
}
```

### Complete Example

```typescript
@Controller('problems')
@UseInterceptors(CacheInvalidateInterceptor)
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  @CacheInvalidate({
    patterns: ['problems:*'],
    tags: ['problems', 'list'],
  })
  async create(@Body() createDto: CreateProblemDto) {
    return await this.problemsService.create(createDto);
  }

  @Put(':id')
  @CacheInvalidate({
    keyGenerator: (req, id: string) => `problem:${id}`,
    patterns: ['problems:*'],
    tags: ['problem', 'detail'],
  })
  async update(@Param('id') id: string, @Body() updateDto: UpdateProblemDto) {
    return await this.problemsService.update(id, updateDto);
  }

  @Delete(':id')
  @CacheInvalidate({
    keyGenerator: (req, id: string) => `problem:${id}`,
    patterns: ['problems:*'],
  })
  async remove(@Param('id') id: string) {
    return await this.problemsService.remove(id);
  }
}
```

## Combining Both Decorators

```typescript
@Controller('users')
@UseInterceptors(CacheableInterceptor, CacheInvalidateInterceptor)
export class UserController {
  // Read operation - cached
  @Get(':id/profile')
  @Cacheable({
    ttl: CACHE_TTL.ONE_HOUR,
    keyGenerator: (req, id: string) => `user:${id}:profile`,
    tags: ['user', 'profile'],
  })
  async getProfile(@Param('id') id: string) {
    return await this.userService.getProfile(id);
  }

  // Write operation - invalidates cache
  @Put(':id/profile')
  @CacheInvalidate({
    keyGenerator: (req, id: string) => `user:${id}:profile`,
    tags: ['profile'],
  })
  async updateProfile(@Param('id') id: string, @Body() data: UpdateProfileDto) {
    return await this.userService.updateProfile(id, data);
  }
}
```

## Real-World Example: Programming Language Controller

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import {
  Cacheable,
  CacheInvalidate,
  CacheableInterceptor,
  CacheInvalidateInterceptor,
  CACHE_TTL,
  CacheKeys,
} from 'src/modules/redis';

@Controller('programming-languages')
@UseInterceptors(CacheableInterceptor, CacheInvalidateInterceptor)
export class ProgrammingLanguageController {
  constructor(
    private readonly programmingLanguageService: ProgrammingLanguageService,
  ) {}

  @Get()
  @Cacheable({
    ttl: CACHE_TTL.ONE_DAY,
    keyGenerator: () => CacheKeys.language.all(),
    tags: ['language', 'list'],
  })
  async findAll() {
    return await this.programmingLanguageService.findAll();
  }

  @Get('active')
  @Cacheable({
    ttl: CACHE_TTL.ONE_DAY,
    keyGenerator: () => CacheKeys.language.active(),
    tags: ['language', 'active'],
  })
  async findActive() {
    return await this.programmingLanguageService.findActive();
  }

  @Get(':id')
  @Cacheable({
    ttl: CACHE_TTL.ONE_DAY,
    keyGenerator: (req, id: string) => CacheKeys.language.byId(id),
    tags: ['language', 'detail'],
  })
  async findOne(@Param('id') id: string) {
    return await this.programmingLanguageService.findOne(id);
  }

  @Post()
  @CacheInvalidate({
    patterns: ['language:*'],
    tags: ['language', 'list', 'active'],
  })
  async create(@Body() createDto: CreateLanguageDto) {
    return await this.programmingLanguageService.create(createDto);
  }

  @Put(':id')
  @CacheInvalidate({
    keyGenerator: (req, id: string) => CacheKeys.language.byId(id),
    patterns: ['language:*'],
    tags: ['language'],
  })
  async update(@Param('id') id: string, @Body() updateDto: UpdateLanguageDto) {
    return await this.programmingLanguageService.update(id, updateDto);
  }

  @Delete(':id')
  @CacheInvalidate({
    keyGenerator: (req, id: string) => CacheKeys.language.byId(id),
    patterns: ['language:*'],
  })
  async remove(@Param('id') id: string) {
    return await this.programmingLanguageService.remove(id);
  }
}
```

## Best Practices

### 1. Use Appropriate TTL Values

```typescript
// Static data - long TTL
@Cacheable({ ttl: CACHE_TTL.ONE_DAY })
async getLanguages() { }

// Semi-static data - medium TTL
@Cacheable({ ttl: CACHE_TTL.ONE_HOUR })
async getProblemDetails() { }

// Dynamic data - short TTL
@Cacheable({ ttl: CACHE_TTL.FIVE_MINUTES })
async getStatistics() { }
```

### 2. Use Tags for Related Caches

```typescript
// Tag all user-related caches
@Cacheable({ tags: ['user', 'profile'] })
async getProfile() { }

@Cacheable({ tags: ['user', 'settings'] })
async getSettings() { }

// Invalidate all user caches at once
@CacheInvalidate({ tags: ['user'] })
async updateUser() { }
```

### 3. Use Custom Key Generators for Dynamic Keys

```typescript
@Cacheable({
  keyGenerator: (req, userId: string, type: string) => `user:${userId}:${type}`,
})
async getUserData(
  @Param('userId') userId: string,
  @Param('type') type: string,
) {
  // Cache key: user:123:profile or user:123:settings
}
```

### 4. Combine Patterns and Tags

```typescript
@CacheInvalidate({
  patterns: ['user:*:profile'],  // Specific pattern
  tags: ['user'],                 // Broader invalidation
})
async updateUserProfile() { }
```

## Troubleshooting

### Cache Not Working

1. Make sure you've applied the interceptor:

```typescript
@UseInterceptors(CacheableInterceptor)
```

2. Check that Redis is running and connected

3. Verify the cache key is being generated correctly (check logs)

### Cache Not Invalidating

1. Ensure `CacheInvalidateInterceptor` is applied

2. Verify the pattern/key matches the cached keys

3. Check that tags were set when caching

### Performance Issues

1. Don't cache methods that are called very frequently with different parameters

2. Use appropriate TTL values - don't cache forever

3. Consider using `CacheService` directly for more control

## When to Use Decorators vs Direct CacheService

**Use Decorators When**:

- Simple caching needs
- Standard CRUD operations
- Consistent caching patterns

**Use CacheService Directly When**:

- Complex caching logic
- Conditional caching
- Need fine-grained control
- Caching in services (not controllers)

```typescript
// Direct CacheService usage in a service
@Injectable()
export class UserService {
  constructor(private readonly cacheService: CacheService) {}

  async getProfile(userId: string) {
    return await this.cacheService.getOrSet(
      `user:${userId}:profile`,
      async () => {
        // Complex logic here
        return await this.fetchFromDatabase(userId);
      },
      { ttl: 3600, tags: ['user', 'profile'] },
    );
  }
}
```

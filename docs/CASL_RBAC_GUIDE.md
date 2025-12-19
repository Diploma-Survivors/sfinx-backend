# Comprehensive CASL RBAC Implementation Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Core Concepts](#core-concepts)
4. [Installation](#installation)
5. [Actions & Subjects](#actions--subjects)
6. [Ability Factory](#ability-factory)
7. [Guards & Decorators](#guards--decorators)
8. [Policy Handlers](#policy-handlers)
9. [Usage Examples](#usage-examples)
10. [Best Practices](#best-practices)
11. [Migration Guide](#migration-guide)
12. [API Reference](#api-reference)

---

## Introduction

This project implements a comprehensive Role-Based Access Control (RBAC) system using **CASL** (Code Access Security Library). CASL provides:

- **Ability-based access control** - Check what actions a user can perform
- **Conditional permissions** - Allow actions based on resource ownership or other conditions
- **Field-level permissions** - Control access to specific fields of resources
- **Type-safe** - Full TypeScript support with type inference
- **Flexible** - Easily define complex authorization logic

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      HTTP Request                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   JwtAuthGuard (Global)                  │
│  - Validates JWT token                                   │
│  - Loads User with Role & Permissions                    │
│  - Attaches user to request.user                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      CaslGuard                           │
│  - Reads @CheckAbility() decorator                       │
│  - Reads @CheckPolicies() decorator                      │
│  - Creates Ability from user                             │
│  - Checks permissions & policies                         │
│  - Throws ForbiddenException if denied                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Controller Method                        │
│  - Access to authenticated user                          │
│  - Business logic execution                              │
└─────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     RbacModule                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │              CaslModule                            │  │
│  │  - CaslAbilityFactory                              │  │
│  └────────────────────────────────────────────────────┘  │
│  - RbacService                                            │
│  - Role Entity                                            │
│  - Permission Entity                                      │
└──────────────────────────────────────────────────────────┘
                           │
                           │ imports
                           ▼
┌──────────────────────────────────────────────────────────┐
│                     AuthModule                            │
│  - JwtAuthGuard (APP_GUARD)                               │
│  - CaslGuard                                              │
│  - RolesGuard (legacy)                                    │
│  - PermissionsGuard (legacy)                              │
│  - User Entity (with role relationship)                   │
└──────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Actions

Actions represent what can be done to a resource:

```typescript
export enum Action {
  Manage = 'manage', // Special: grants all permissions
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  // Custom actions
  ReadPremium = 'read_premium',
  ReadAll = 'read_all',
  Join = 'join',
  JoinPremium = 'join_premium',
  Ban = 'ban',
  // ... more custom actions
}
```

### 2. Subjects

Subjects represent resources that actions can be performed on:

```typescript
export type Subjects =
  | 'Problem'
  | 'Submission'
  | 'Contest'
  | 'User'
  | 'Post'
  | 'Comment'
  | 'Admin'
  | 'AI'
  | 'Payment'
  | 'all'; // Special: represents all resources
```

### 3. Abilities

Abilities define what a user **can** or **cannot** do:

```typescript
// User can create problems
ability.can(Action.Create, 'Problem');

// User cannot access premium problems (free user)
ability.cannot(Action.ReadPremium, 'Problem');

// User can update their own submissions
ability.can(Action.Update, 'Submission', { 'user.id': currentUserId });
```

---

## Installation

CASL is already installed and configured in this project. If you need to set it up in a new project:

```bash
bun add @casl/ability
```

---

## Actions & Subjects

### Defining Actions

**File:** `src/modules/rbac/casl/casl-ability.factory.ts`

```typescript
export enum Action {
  // Standard CRUD
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',

  // Custom actions
  ReadPremium = 'read_premium',
  ReadAll = 'read_all',
  // ... add more as needed
}
```

### Defining Subjects

```typescript
export type Subjects =
  | InferSubjects<typeof User | typeof Problem | typeof Submission>
  | 'Problem'
  | 'Submission'
  | 'Contest'
  // ... more subjects
  | 'all';
```

### Mapping Database Permissions to CASL

The `CaslAbilityFactory` automatically maps database permissions (stored as `resource:action`) to CASL abilities:

```typescript
// Database: { resource: 'problem', action: 'create' }
// CASL: can(Action.Create, 'Problem')
```

---

## Ability Factory

### CaslAbilityFactory

**File:** `src/modules/rbac/casl/casl-ability.factory.ts`

The factory creates an `Ability` object for each user based on their role and permissions:

```typescript
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    // If no role, return empty ability
    if (!user || !user.role) {
      return build(...);
    }

    // Admin gets full access
    if (user.role.slug === 'admin') {
      can(Action.Manage, 'all');
      return build(...);
    }

    // Map permissions to abilities
    permissions.forEach((permission: Permission) => {
      const action = this.mapActionToCasl(permission.action);
      const subject = this.mapResourceToSubject(permission.resource);
      can(action, subject);
    });

    // Define conditional permissions
    this.defineConditionalPermissions(can, cannot, user, permissions);

    return build(...);
  }
}
```

### Conditional Permissions

The factory automatically handles ownership-based and premium-based permissions:

```typescript
private defineConditionalPermissions(can, cannot, user, permissions) {
  // Users can update their own profile
  if (this.hasPermission(permissions, 'user', 'update')) {
    can(Action.Update, 'User', { id: user.id });
  }

  // Users can read their own submissions
  if (this.hasPermission(permissions, 'submission', 'read')) {
    can(Action.Read, 'Submission', { 'user.id': user.id });
  }

  // Premium users can access premium content
  if (user.isPremium) {
    can(Action.ReadPremium, 'Problem');
    can(Action.ReadPremium, Problem, { isPremium: true });
  } else {
    cannot(Action.ReadPremium, 'Problem');
  }

  // Banned users cannot create content
  if (user.isBanned) {
    cannot(Action.Create, 'Post');
    cannot(Action.Create, 'Comment');
    cannot(Action.Create, 'Submission');
  }
}
```

---

## Guards & Decorators

### CaslGuard

**File:** `src/modules/auth/guards/casl.guard.ts`

The guard enforces CASL-based authorization:

```typescript
@Injectable()
export class CaslGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read rules from @CheckAbility() decorator
    const rules = this.reflector.get<RequiredRule[]>(...);

    // Read policies from @CheckPolicies() decorator
    const policyHandlers = this.reflector.get<PolicyHandler[]>(...);

    // If no rules/policies, allow access
    if (rules.length === 0 && policyHandlers.length === 0) {
      return true;
    }

    const user = request.user;
    const ability = this.caslAbilityFactory.createForUser(user);

    // Check all rules
    for (const rule of rules) {
      if (!ability.can(rule.action, rule.subject, rule.conditions)) {
        throw new ForbiddenException(...);
      }
    }

    // Check all policies
    for (const handler of policyHandlers) {
      if (!handler(ability) && !handler.handle(ability)) {
        throw new ForbiddenException(...);
      }
    }

    return true;
  }
}
```

### @CheckAbility() Decorator

**File:** `src/common/decorators/casl.decorator.ts`

Use this decorator to check CASL abilities on routes:

```typescript
// Simple permission
@CheckAbility({ action: Action.Create, subject: 'Problem' })

// Multiple permissions (user needs ALL)
@CheckAbility(
  { action: Action.Create, subject: 'Problem' },
  { action: Action.Update, subject: 'Problem' }
)

// Conditional permission
@CheckAbility({
  action: Action.Update,
  subject: 'User',
  conditions: { id: userId }
})

// Field-level permission
@CheckAbility({
  action: Action.Read,
  subject: 'User',
  fields: ['email', 'phone']
})
```

### @CheckPolicies() Decorator

Use this for complex authorization logic:

```typescript
// Using policy class
@CheckPolicies(new ManageProblemsPolicy())

// Using inline callback
@CheckPolicies((ability) => ability.can(Action.Create, 'Problem'))

// Multiple policies
@CheckPolicies(
  new AdminAccessPolicy(),
  (ability) => ability.can(Action.Manage, 'all')
)
```

---

## Policy Handlers

**File:** `src/modules/rbac/casl/policies/index.ts`

Policy handlers encapsulate complex authorization logic:

```typescript
export class ManageProblemsPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Create, 'Problem') ||
      ability.can(Action.Update, 'Problem') ||
      ability.can(Action.Delete, 'Problem')
    );
  }
}

export class AdminAccessPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Access, 'Admin');
  }
}

export class PremiumAccessPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.ReadPremium, 'Problem');
  }
}
```

### Creating Custom Policies

```typescript
export class CustomPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    // Your complex logic here
    return (
      ability.can(Action.Read, 'Problem') &&
      ability.can(Action.Create, 'Submission')
    );
  }
}
```

---

## Usage Examples

### Example 1: Simple Permission Check

```typescript
@Post('problems')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblem(@Body() data: CreateProblemDto, @GetUser() user: User) {
  return this.problemsService.create(data, user.id);
}
```

### Example 2: Multiple Permissions

```typescript
@Put('problems/:id/manage')
@UseGuards(CaslGuard)
@CheckAbility(
  { action: Action.Update, subject: 'Problem' },
  { action: Action.Delete, subject: 'Problem' }
)
async manageProblem(@Param('id') id: string) {
  // User must have BOTH update AND delete permissions
}
```

### Example 3: Ownership Check

```typescript
@Put('submissions/:id')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Update, subject: 'Submission' })
async updateSubmission(
  @Param('id') id: string,
  @GetUser() user: User
) {
  const submission = await this.submissionsService.findOne(+id);

  // Runtime check for ownership
  const ability = this.rbacService.getUserAbility(user);
  if (!ability.can(Action.Update, submission)) {
    throw new ForbiddenException('You can only update your own submissions');
  }

  return this.submissionsService.update(+id, data);
}
```

### Example 4: Premium Content

```typescript
@Get('problems/premium/:id')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.ReadPremium, subject: 'Problem' })
async getPremiumProblem(@Param('id') id: string) {
  // Only users with isPremium = true can access
  return this.problemsService.findOne(+id);
}
```

### Example 5: Policy-Based

```typescript
@Post('problems/advanced')
@UseGuards(CaslGuard)
@CheckPolicies(new ManageProblemsPolicy())
async createAdvancedProblem(@Body() data: any) {
  // User passes if they can create, update, or delete problems
}
```

### Example 6: Inline Policy

```typescript
@Get('admin/dashboard')
@UseGuards(CaslGuard)
@CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
async getAdminDashboard() {
  // Simple one-off check
}
```

### Example 7: Runtime Permission Check

```typescript
@Delete('posts/:id')
async deletePost(@Param('id') id: string, @GetUser() user: User) {
  const post = await this.postsService.findOne(+id);

  // Manual check using RbacService
  const canDelete = this.rbacService.canUserPerformAction(
    user,
    Action.Delete,
    'Post'
  );

  const isOwner = post.userId === user.id;

  if (!canDelete && !isOwner) {
    throw new ForbiddenException('Cannot delete this post');
  }

  await this.postsService.delete(+id);
}
```

### Example 8: Get User Permissions

```typescript
@Get('me/permissions')
async getMyPermissions(@GetUser() user: User) {
  const summary = await this.rbacService.getUserPermissionSummary(user);

  return {
    role: summary.roleSlug,
    permissions: summary.permissions,
    canManageAll: summary.canManageAll,
    abilities: {
      canCreateProblem: this.rbacService.canUserPerformAction(
        user, Action.Create, 'Problem'
      ),
      canAccessAdmin: this.rbacService.canUserPerformAction(
        user, Action.Access, 'Admin'
      ),
    }
  };
}
```

---

## Best Practices

### 1. Use Decorators for Route-Level Checks

✅ **Good:**

```typescript
@Post('problems')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblem() { ... }
```

❌ **Avoid:**

```typescript
@Post('problems')
async createProblem(@GetUser() user: User) {
  if (!this.rbacService.canUserPerformAction(user, Action.Create, 'Problem')) {
    throw new ForbiddenException();
  }
  // ...
}
```

### 2. Use Policies for Complex Logic

✅ **Good:**

```typescript
export class CanModerateContentPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Delete, 'Post') ||
           ability.can(Action.Delete, 'Comment') ||
           ability.can(Action.Ban, 'User');
  }
}

@Delete('content/:id')
@UseGuards(CaslGuard)
@CheckPolicies(new CanModerateContentPolicy())
async moderateContent() { ... }
```

❌ **Avoid:**

```typescript
@Delete('content/:id')
@UseGuards(CaslGuard)
@CheckAbility(
  { action: Action.Delete, subject: 'Post' },
  { action: Action.Delete, subject: 'Comment' },
  { action: Action.Ban, subject: 'User' }
)
async moderateContent() { ... }
```

### 3. Check Ownership at Runtime

✅ **Good:**

```typescript
async updatePost(id: number, user: User) {
  const post = await this.findOne(id);
  const ability = this.rbacService.getUserAbility(user);

  if (!ability.can(Action.Update, post)) {
    throw new ForbiddenException();
  }

  // Update logic
}
```

### 4. Provide Permission Info to Frontend

```typescript
@Get('me/abilities')
async getMyAbilities(@GetUser() user: User) {
  return {
    canCreateProblem: this.rbacService.canUserPerformAction(
      user, Action.Create, 'Problem'
    ),
    canJoinContest: this.rbacService.canUserPerformAction(
      user, Action.Join, 'Contest'
    ),
    // ... more abilities
  };
}
```

Frontend can use this to show/hide UI elements:

```tsx
if (abilities.canCreateProblem) {
  return <CreateProblemButton />;
}
```

### 5. Combine with Business Logic

```typescript
async publishProblem(id: number, user: User) {
  const problem = await this.findOne(id);

  // CASL check
  if (!this.rbacService.canUserPerformAction(user, Action.Update, 'Problem')) {
    throw new ForbiddenException();
  }

  // Business logic check
  if (!problem.hasTestcases()) {
    throw new BadRequestException('Problem must have testcases before publishing');
  }

  if (!problem.isOwner(user.id) && user.role.slug !== 'admin') {
    throw new ForbiddenException('Only owner or admin can publish');
  }

  problem.publish();
  return this.save(problem);
}
```

---

## Migration Guide

### From Old Guards to CASL

**Old Approach:**

```typescript
@Post('problems')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('admin')
@RequirePermissions('problem:create')
async createProblem() { ... }
```

**New Approach (CASL):**

```typescript
@Post('problems')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblem() { ... }
```

### Advantages of CASL Over Old System

| Feature                 | Old System              | CASL               |
| ----------------------- | ----------------------- | ------------------ |
| Conditional permissions | ❌ Not supported        | ✅ Full support    |
| Ownership checks        | ⚠️ Manual               | ✅ Built-in        |
| Field-level permissions | ❌ Not supported        | ✅ Supported       |
| Complex policies        | ⚠️ Multiple decorators  | ✅ Policy handlers |
| Type safety             | ⚠️ String-based         | ✅ Enum-based      |
| Runtime checks          | ⚠️ Manual service calls | ✅ Integrated API  |
| Testing                 | ⚠️ Difficult            | ✅ Easy to test    |

### Gradual Migration

You can use both systems simultaneously:

```typescript
// Old system (still works)
@Post('problems/old')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('admin')
@RequirePermissions('problem:create')
async createProblemOld() { ... }

// New system (CASL)
@Post('problems/new')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblemNew() { ... }
```

---

## API Reference

### CaslAbilityFactory

#### `createForUser(user: User): AppAbility`

Creates an Ability object for the given user.

```typescript
const ability = caslAbilityFactory.createForUser(user);
const canCreate = ability.can(Action.Create, 'Problem');
```

---

### RbacService

#### `canUserPerformAction(user, action, subject, conditions?): boolean`

Check if user can perform action on subject.

```typescript
const canCreate = rbacService.canUserPerformAction(
  user,
  Action.Create,
  'Problem',
);
```

#### `canUserPerformActionOnInstance<T>(user, action, instance): boolean`

Check if user can perform action on specific instance.

```typescript
const submission = await findOne(id);
const canUpdate = rbacService.canUserPerformActionOnInstance(
  user,
  Action.Update,
  submission,
);
```

#### `getUserAbility(user): AppAbility`

Get user's CASL ability object.

```typescript
const ability = rbacService.getUserAbility(user);
```

#### `getUserActionsForSubject(user, subject): Action[]`

Get all actions user can perform on subject.

```typescript
const actions = rbacService.getUserActionsForSubject(user, 'Problem');
// Returns: [Action.Read, Action.Create, ...]
```

#### `checkMultiplePermissions(user, checks): boolean[]`

Check multiple permissions at once.

```typescript
const results = rbacService.checkMultiplePermissions(user, [
  { action: Action.Create, subject: 'Problem' },
  { action: Action.Delete, subject: 'Problem' },
]);
// Returns: [true, false]
```

#### `getUserPermissionSummary(user): Promise<PermissionSummary>`

Get user's permission summary.

```typescript
const summary = await rbacService.getUserPermissionSummary(user);
/*
{
  roleSlug: 'admin',
  roleName: 'Admin',
  permissions: ['problem:create', 'problem:update', ...],
  canManageAll: true
}
*/
```

---

## Testing

### Unit Testing Abilities

```typescript
import { CaslAbilityFactory, Action } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  it('should allow admin to manage all', () => {
    const adminUser = {
      id: 1,
      role: { slug: 'admin', permissions: [] },
    } as User;

    const ability = factory.createForUser(adminUser);

    expect(ability.can(Action.Manage, 'all')).toBe(true);
    expect(ability.can(Action.Create, 'Problem')).toBe(true);
    expect(ability.can(Action.Delete, 'User')).toBe(true);
  });

  it('should allow free user to read problems', () => {
    const freeUser = {
      id: 2,
      isPremium: false,
      role: {
        slug: 'free',
        permissions: [{ resource: 'problem', action: 'read' }],
      },
    } as User;

    const ability = factory.createForUser(freeUser);

    expect(ability.can(Action.Read, 'Problem')).toBe(true);
    expect(ability.can(Action.ReadPremium, 'Problem')).toBe(false);
  });

  it('should allow user to update own submission', () => {
    const user = {
      id: 3,
      role: {
        permissions: [{ resource: 'submission', action: 'read' }],
      },
    } as User;

    const ability = factory.createForUser(user);
    const ownSubmission = { id: 1, user: { id: 3 } };
    const otherSubmission = { id: 2, user: { id: 999 } };

    expect(ability.can(Action.Read, ownSubmission)).toBe(true);
    expect(ability.can(Action.Read, otherSubmission)).toBe(false);
  });
});
```

### Integration Testing Guards

```typescript
describe('CaslGuard', () => {
  it('should allow access with correct ability', async () => {
    // Mock request with user
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 1, role: { slug: 'admin', permissions: [] } },
        }),
      }),
      getHandler: () => mockHandler,
    };

    const guard = new CaslGuard(reflector, caslAbilityFactory);
    const canActivate = await guard.canActivate(mockExecutionContext);

    expect(canActivate).toBe(true);
  });
});
```

---

## Troubleshooting

### Issue: "User not authenticated"

**Cause:** User object not available on request.

**Solution:** Ensure `JwtAuthGuard` is applied before `CaslGuard`.

### Issue: Permission denied even though user has permission

**Cause:** Permission not mapped correctly in `CaslAbilityFactory`.

**Solution:** Check `mapActionToCasl` and `mapResourceToSubject` methods.

### Issue: Conditional permissions not working

**Cause:** Conditions not defined in `defineConditionalPermissions`.

**Solution:** Add your conditional logic:

```typescript
if (this.hasPermission(permissions, 'post', 'update')) {
  can(Action.Update, 'Post', { 'user.id': user.id });
}
```

---

## Additional Resources

- **CASL Documentation:** https://casl.js.org/v6/en/
- **NestJS Guards:** https://docs.nestjs.com/guards
- **Example File:** `src/modules/rbac/examples/casl-controller.example.ts`

---

## Conclusion

This comprehensive CASL implementation provides a flexible, type-safe, and powerful authorization system. It supports:

✅ Simple action-subject permissions
✅ Conditional permissions (ownership, premium status)
✅ Field-level permissions
✅ Complex policy-based authorization
✅ Runtime permission checks
✅ Full TypeScript support
✅ Easy testing

For questions or issues, refer to the example file or create an issue in the repository.

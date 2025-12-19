# CASL Quick Reference

## Quick Start

### 1. Basic Permission Check

```typescript
@Post('problems')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblem(@GetUser() user: User) {
  // Your code here
}
```

### 2. Multiple Permissions (AND logic)

```typescript
@Put('problems/:id')
@UseGuards(CaslGuard)
@CheckAbility(
  { action: Action.Update, subject: 'Problem' },
  { action: Action.Delete, subject: 'Problem' }
)
async manageProblem() { ... }
```

### 3. Policy-Based Check

```typescript
@Get('admin/dashboard')
@UseGuards(CaslGuard)
@CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
async getAdminDashboard() { ... }
```

### 4. Runtime Check (Ownership)

```typescript
async updatePost(id: number, @GetUser() user: User) {
  const post = await this.findOne(id);

  const ability = this.rbacService.getUserAbility(user);
  if (!ability.can(Action.Update, post)) {
    throw new ForbiddenException();
  }

  // Update logic
}
```

---

## Common Actions

```typescript
Action.Create; // Create new resources
Action.Read; // View resources
Action.Update; // Modify resources
Action.Delete; // Remove resources
Action.Manage; // All permissions (admin only)
Action.ReadPremium; // Access premium content
Action.ReadAll; // View all (not just own)
Action.Ban; // Ban users
Action.Access; // Access admin panel
```

---

## Common Subjects

```typescript
'Problem'; // Coding problems
'Submission'; // Code submissions
'Contest'; // Contests
'User'; // User profiles
'Post'; // Forum posts
'Comment'; // Comments
'Admin'; // Admin features
'AI'; // AI features
'Payment'; // Payment features
'all'; // All resources (use with Action.Manage)
```

---

## Import Statements

```typescript
// Guards
import { CaslGuard } from '../auth/guards/casl.guard';

// Decorators
import { CheckAbility, CheckPolicies } from '../../common';

// Types
import { Action } from '../rbac/casl/casl-ability.factory';

// Service
import { RbacService } from '../rbac/rbac.service';

// User decorator
import { GetUser } from '../../common';
```

---

## RbacService Quick Methods

```typescript
// Check single permission
rbacService.canUserPerformAction(user, Action.Create, 'Problem');
// Returns: boolean

// Check on instance
rbacService.canUserPerformActionOnInstance(user, Action.Update, submission);
// Returns: boolean

// Get ability
rbacService.getUserAbility(user);
// Returns: AppAbility

// Get all actions for subject
rbacService.getUserActionsForSubject(user, 'Problem');
// Returns: Action[]

// Check multiple permissions
rbacService.checkMultiplePermissions(user, [
  { action: Action.Create, subject: 'Problem' },
  { action: Action.Delete, subject: 'Problem' },
]);
// Returns: boolean[]

// Get permission summary
await rbacService.getUserPermissionSummary(user);
// Returns: { roleSlug, roleName, permissions[], canManageAll }
```

---

## Common Patterns

### Pattern 1: Admin-Only Endpoint

```typescript
@Delete('users/:id')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Delete, subject: 'User' })
async deleteUser(@Param('id') id: string) { ... }
```

### Pattern 2: Premium Content

```typescript
@Get('problems/premium/:id')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.ReadPremium, subject: 'Problem' })
async getPremiumProblem(@Param('id') id: string) { ... }
```

### Pattern 3: Update Own Resource

```typescript
@Put('posts/:id')
async updatePost(
  @Param('id') id: string,
  @GetUser() user: User
) {
  const post = await this.postsService.findOne(+id);
  const ability = this.rbacService.getUserAbility(user);

  if (!ability.can(Action.Update, post)) {
    throw new ForbiddenException('You can only update your own posts');
  }

  return this.postsService.update(+id, data);
}
```

### Pattern 4: Complex Authorization

```typescript
@Put('problems/:id/publish')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Update, subject: 'Problem' })
async publishProblem(@Param('id') id: string, @GetUser() user: User) {
  const problem = await this.problemsService.findOne(+id);

  // Check if user is owner or admin
  const isOwner = problem.createdBy === user.id;
  const isAdmin = user.role?.slug === 'admin';

  if (!isAdmin && !isOwner) {
    throw new ForbiddenException('Only owner or admin can publish');
  }

  // Additional business logic...
  return this.problemsService.publish(+id);
}
```

### Pattern 5: Return User Abilities (for Frontend)

```typescript
@Get('me/abilities')
async getMyAbilities(@GetUser() user: User) {
  return {
    canCreateProblem: this.rbacService.canUserPerformAction(
      user, Action.Create, 'Problem'
    ),
    canViewAllSubmissions: this.rbacService.canUserPerformAction(
      user, Action.ReadAll, 'Submission'
    ),
    canAccessAdmin: this.rbacService.canUserPerformAction(
      user, Action.Access, 'Admin'
    ),
    isPremium: user.isPremium,
  };
}
```

---

## Custom Policies

Create a policy file: `src/modules/rbac/casl/policies/custom.policy.ts`

```typescript
import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

export class MyCustomPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Create, 'Problem') &&
      ability.can(Action.Update, 'Problem')
    );
  }
}
```

Use it in controller:

```typescript
import { MyCustomPolicy } from '../rbac/casl/policies/custom.policy';

@Post('problems/special')
@UseGuards(CaslGuard)
@CheckPolicies(new MyCustomPolicy())
async createSpecialProblem() { ... }
```

---

## Testing Examples

### Unit Test

```typescript
describe('ProblemController', () => {
  it('should create problem with correct permissions', async () => {
    const user = {
      id: 1,
      role: { slug: 'admin', permissions: [] },
    } as User;

    const ability = caslAbilityFactory.createForUser(user);

    expect(ability.can(Action.Create, 'Problem')).toBe(true);
  });
});
```

### E2E Test

```typescript
describe('POST /problems', () => {
  it('should allow admin to create problem', () => {
    return request(app.getHttpServer())
      .post('/problems')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createProblemDto)
      .expect(201);
  });

  it('should deny free user from creating problem', () => {
    return request(app.getHttpServer())
      .post('/problems')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .send(createProblemDto)
      .expect(403);
  });
});
```

---

## Troubleshooting

### Error: "You do not have permission to..."

**Check:**

1. User has correct role assigned
2. Role has required permissions
3. Permission resource and action match exactly
4. CaslGuard is applied: `@UseGuards(CaslGuard)`

### Error: "User not authenticated"

**Check:**

1. JWT token is valid
2. JwtAuthGuard is applied (globally)
3. Route is not marked with `@Public()`

### Conditional permission not working

**Check:**

1. Condition is defined in `CaslAbilityFactory.defineConditionalPermissions()`
2. Entity field names match (e.g., `user.id` vs `userId`)
3. Entity is loaded with required relations

---

## Migration from Old System

**Old:**

```typescript
@Post('problems')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('admin')
@RequirePermissions('problem:create')
async createProblem() { ... }
```

**New:**

```typescript
@Post('problems')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblem() { ... }
```

---

## Resources

- **Full Documentation:** `docs/CASL_RBAC_GUIDE.md`
- **Examples:** `src/modules/rbac/examples/casl-controller.example.ts`
- **CASL Docs:** https://casl.js.org/v6/en/

---

## Cheat Sheet

| Task             | Code                                                               |
| ---------------- | ------------------------------------------------------------------ |
| Import guard     | `import { CaslGuard } from '../auth/guards/casl.guard'`            |
| Import decorator | `import { CheckAbility } from '../../common'`                      |
| Import Action    | `import { Action } from '../rbac/casl/casl-ability.factory'`       |
| Apply guard      | `@UseGuards(CaslGuard)`                                            |
| Simple check     | `@CheckAbility({ action: Action.Create, subject: 'Problem' })`     |
| Policy check     | `@CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))` |
| Runtime check    | `rbacService.canUserPerformAction(user, Action.Create, 'Problem')` |
| Get ability      | `rbacService.getUserAbility(user)`                                 |
| Check ownership  | `ability.can(Action.Update, instance)`                             |

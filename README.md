# sFinx Backend - LeetCode Clone API

A production-ready NestJS backend for a LeetCode-style coding platform with comprehensive features including authentication, problem management, code submission with Judge0 integration, and more.

## 🚀 Features Implemented

### ✅ **Phase 1: Foundation & Configuration**

- TypeORM Integration with PostgreSQL
- Environment Configuration (.env setup)
- Swagger Documentation at `/api/docs`
- Global Error Handling & Validation
- CORS & Security Configuration

### ✅ **Phase 2: Authentication & Authorization**

- JWT Authentication (Access + Refresh Tokens)
- User Management with OAuth support
- **Comprehensive CASL-Based RBAC System** (NEW!)
  - Ability-based access control
  - Conditional permissions (ownership, premium status)
  - Field-level permissions
  - Policy-based authorization
  - Runtime permission checks
- Legacy RBAC System (Roles & Permissions)
- Custom Guards & Decorators
- Password Hashing with bcrypt

### ✅ **Phase 3: Problems Management**

- Problem CRUD Operations
- Advanced Filtering & Search
- Testcases Management
- Topics & Tags System
- 12 Programming Languages Support
- Statistics Tracking

### ✅ **Phase 4: Submissions System**

- Submission Tracking & Management
- User Progress Management
- Multiple Status Types (Accepted, Wrong Answer, TLE, etc.)
- User Statistics & Progress Tracking
- Test Run Support

## 📦 Tech Stack

- **Framework**: NestJS 11.x
- **Database**: PostgreSQL 14+
- **ORM**: TypeORM 0.3.x
- **Authentication**: JWT + Passport
- **Documentation**: Swagger/OpenAPI
- **Code Judge**: Judge0 API
- **Testing**: Jest

## 🛠️ Installation

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 14+
- Redis (optional)

### 1. Install dependencies

```bash
bun install
# or npm install
```

### 2. Setup environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Required Environment Variables:**

- **Database**: Update `DB_*` variables with your PostgreSQL credentials
- **JWT Secrets**: Generate secure random strings for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- **AWS S3** (for testcase storage): Configure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_S3_REGION`
- **Other services**: Judge0, OAuth providers (Google, GitHub), VNPay, etc. are optional

### 3. Create database

```bash
# Create the PostgreSQL database
createdb sfinx

# Or using psql
psql -U postgres -c "CREATE DATABASE sfinx;"
```

### 4. Run migrations

```bash
# Run all pending migrations
bun run migration:run

# Or to revert the last migration
bun run migration:revert
```

### 5. Seed the database

```bash
# Seed roles, permissions, programming languages, and topics
bun run seed:run
```

**Note**: Make sure to update your `.env` file with the correct database credentials before running migrations.

### 6. Start the server

```bash
bun run start:dev
```

**API**: http://localhost:3000/api
**Docs**: http://localhost:3000/api/docs

## 🔐 CASL Authorization System

This project implements a comprehensive authorization system using **CASL** (Code Access Security Library) for flexible, fine-grained access control.

### Features

- **Ability-based Access Control**: Check what actions users can perform on resources
- **Conditional Permissions**: Permission based on ownership, premium status, etc.
- **Field-level Permissions**: Control access to specific fields of entities
- **Policy-based Authorization**: Define complex authorization logic
- **Type-safe**: Full TypeScript support with enums and type inference
- **Runtime Checks**: Programmatic permission checks in business logic

### Quick Example

```typescript
// Simple permission check
@Post('problems')
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
async createProblem() { ... }

// Policy-based check
@Get('admin/dashboard')
@UseGuards(CaslGuard)
@CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
async getAdminDashboard() { ... }

// Runtime ownership check
const ability = this.rbacService.getUserAbility(user);
if (!ability.can(Action.Update, submission)) {
  throw new ForbiddenException('You can only update your own submissions');
}
```

### Documentation

- **Full Guide**: [`docs/CASL_RBAC_GUIDE.md`](docs/CASL_RBAC_GUIDE.md) - Comprehensive documentation with examples
- **Quick Reference**: [`docs/CASL_QUICK_REFERENCE.md`](docs/CASL_QUICK_REFERENCE.md) - Quick lookup for common patterns
- **Example Controller**: [`src/modules/rbac/examples/casl-controller.example.ts`](src/modules/rbac/examples/casl-controller.example.ts) - 13 practical examples

### Available Actions

```typescript
(Action.Create, Action.Read, Action.Update, Action.Delete);
Action.Manage; // All permissions (admin)
Action.ReadPremium; // Access premium content
Action.ReadAll; // View all resources (not just own)
Action.Ban; // Ban users
Action.Access; // Access admin features
// ... and more
```

### Available Subjects

```typescript
('Problem',
  'Submission',
  'Contest',
  'User',
  'Post',
  'Comment',
  'Admin',
  'AI',
  'Payment',
  'all');
```

### Migration from Old System

Both systems work simultaneously. You can gradually migrate:

**Old System:**

```typescript
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('admin')
@RequirePermissions('problem:create')
```

**New System (CASL):**

```typescript
@UseGuards(CaslGuard)
@CheckAbility({ action: Action.Create, subject: 'Problem' })
```

## 📚 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Problems

- `GET /api/problems` - List problems (with filtering)
- `GET /api/problems/:id` - Get problem by ID
- `GET /api/problems/slug/:slug` - Get problem by slug
- `POST /api/problems` - Create problem (Admin)
- `PUT /api/problems/:id` - Update problem (Admin)
- `DELETE /api/problems/:id` - Delete problem (Admin)

### Testcases (S3 Storage)

- `POST /api/problems/testcases/upload` - Upload testcase file (Admin)
- `GET /api/problems/:id/testcases/content` - Get testcase content (Admin)
- `DELETE /api/problems/:id/testcases` - Delete testcase file (Admin)

### Sample Testcases

- `POST /api/problems/samples` - Create sample testcase (Admin)
- `GET /api/problems/:id/samples` - Get sample testcases (Public)
- `DELETE /api/problems/samples/:id` - Delete sample testcase (Admin)

### Submissions

- `POST /api/submissions` - Submit code for a problem
- `GET /api/submissions` - Get all submissions (Admin)
- `GET /api/submissions/:id` - Get submission by ID
- `GET /api/submissions/user/me` - Get current user's submissions
- `GET /api/submissions/user/me/statistics` - Get user statistics
- `GET /api/submissions/user/me/progress` - Get all user problem progress
- `GET /api/submissions/problem/:problemId/progress` - Get user progress for a problem
- `GET /api/submissions/problem/:problemId` - Get all submissions for a problem

## 🗄️ Database Schema

Main tables:

- **Auth**: users, refresh_tokens, roles, permissions
- **Problems**: problems, sample_testcases, topics, tags, programming_languages
  - Full testcases stored in S3 (referenced by testcaseFileUrl in problems table)
- **Submissions**: submissions, user_problem_progress

### Migration Files

The initial database schema is defined in:

- `src/database/migrations/1734325000000-InitialSchema.ts`

This migration creates all necessary tables, indexes, and constraints.

## 🧪 Testing

```bash
bun test              # Unit tests
bun test:e2e          # E2E tests
bun test:cov          # Coverage
```

## 📝 Scripts

```bash
bun run start:dev         # Development
bun run build             # Build
bun run migration:run     # Run migrations
bun run seed:run          # Run seeds
bun run lint              # Lint code
bun run format            # Format code
```

## 🔜 Next Steps

1. Judge0 API Integration for Code Execution
2. Database Migrations Generation
3. Contest System
4. Payment Integration (VNPay)
5. AI Features (Mock Interviews)
6. Community Features (Discussion Forum)

## 📄 License

UNLICENSED

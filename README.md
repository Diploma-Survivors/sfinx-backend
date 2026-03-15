# SfinX Backend

> A LeetCode-style competitive programming platform — NestJS · PostgreSQL · Redis · Judge0

**API**: `http://localhost:3000/api` | **Swagger**: `http://localhost:3000/api/docs`

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture — C4 Container Diagram](#architecture--c4-container-diagram)
4. [Code Submission Flow — Sequence Diagram](#code-submission-flow--sequence-diagram)
5. [Submission Lifecycle — State Machine](#submission-lifecycle--state-machine)
6. [Database Schema — ERD](#database-schema--erd)
7. [Module Breakdown](#module-breakdown)
8. [Quick Start](#quick-start)
9. [Key Technical Highlights](#key-technical-highlights)

---

## Overview

**SfinX** is a full-featured online judge platform built from scratch as a graduation thesis project. Users can:

- Solve algorithmic problems with **automatic grading** (12 languages via Judge0)
- Compete in **real-time contests** (ACM / IOI ranking)
- Practice **AI mock interviews** with voice support (LiveKit + Google Gemini)
- Discuss and share solutions in a **community forum**
- Subscribe to **Premium** via VNPay for exclusive content

---

## Tech Stack

| Layer              | Technology                                              |
| ------------------ | ------------------------------------------------------- |
| **Framework**      | NestJS 11.x (TypeScript 5.7, strict mode)               |
| **Database**       | PostgreSQL 14+ · TypeORM 0.3.x · 59 migrations          |
| **Cache / Queue**  | Redis 7.x · BullMQ 5.x · Lua scripts                    |
| **Auth**           | JWT RS256 (Access + Refresh) · Google OAuth · CASL RBAC |
| **Code Execution** | Judge0 API (self-hosted or cloud)                       |
| **AI**             | Google Gemini · LangChain · Langfuse tracing            |
| **Voice**          | LiveKit WebRTC                                          |
| **Storage**        | AWS S3 (testcase files, streaming JSON parse)           |
| **Payment**        | VNPay (HMAC verification)                               |
| **Email**          | Brevo / SMTP (Handlebars templates)                     |
| **DevOps**         | Docker Compose · GitHub Actions CI/CD · Husky           |

---

## Architecture — C4 Container Diagram

```mermaid
C4Container
  title SfinX — Container Diagram

  Person(user, "User", "Solves problems, joins contests, does AI interviews")
  Person(admin, "Admin", "Manages problems, contests, subscriptions")

  System_Boundary(sfinx, "SfinX Platform") {
    Container(frontend, "Next.js Frontend", "React / Next.js", "Web UI: problem editor, leaderboard, interview session")
    Container(api, "NestJS API", "NestJS / TypeScript", "REST API + SSE + WebSocket. Handles auth, submissions, contests, payments, AI")
    ContainerDb(db, "PostgreSQL", "PostgreSQL 14+", "Primary data store: users, problems, submissions, contests, payments")
    ContainerDb(redis, "Redis", "Redis 7", "Cache · BullMQ job queue · Pub/Sub for SSE · Distributed lock")
  }

  System_Ext(judge0, "Judge0", "Sandboxed code execution engine. Supports 12 languages")
  System_Ext(s3, "AWS S3", "Stores testcase files as streaming JSON")
  System_Ext(gemini, "Google Gemini / LangChain", "LLM for AI interview evaluation and code review")
  System_Ext(livekit, "LiveKit", "Real-time voice WebRTC for AI interview voice mode")
  System_Ext(vnpay, "VNPay", "Vietnamese payment gateway for Premium subscriptions")
  System_Ext(google_oauth, "Google OAuth", "Third-party login via Google")
  System_Ext(brevo, "Brevo / SMTP", "Transactional emails: verification, payment receipt")
  System_Ext(langfuse, "Langfuse", "LLM observability and prompt tracing")

  Rel(user, frontend, "Uses", "HTTPS")
  Rel(admin, frontend, "Manages via", "HTTPS")
  Rel(frontend, api, "REST / SSE / WebSocket", "JSON")

  Rel(api, db, "Read / Write", "TypeORM")
  Rel(api, redis, "Cache · Queue · PubSub · Lock", "ioredis")
  Rel(api, judge0, "Submit batch code", "HTTP POST /submissions/batch")
  Rel(judge0, api, "Async callback per testcase", "HTTP PUT /submissions/judge0/callback/submit?sid=&tcid=")
  Rel(api, s3, "Upload / stream testcases", "AWS SDK")
  Rel(api, gemini, "Generate AI content", "LangChain / HTTP")
  Rel(api, livekit, "Create room, dispatch agent", "LiveKit SDK")
  Rel(api, vnpay, "Create payment URL", "HTTPS redirect")
  Rel(vnpay, api, "Payment result callback", "HTTPS GET callback")
  Rel(api, google_oauth, "OAuth2 token exchange", "HTTPS")
  Rel(api, brevo, "Send email", "SMTP / REST")
  Rel(api, langfuse, "Trace LLM calls", "HTTP")
```

---

## Code Submission Flow — Sequence Diagram

This diagram covers the full async journey from a user clicking **Submit** to receiving the result via SSE.

```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant API as NestJS API
  participant DB as PostgreSQL
  participant Redis
  participant Judge0
  participant BullMQ
  participant SSE as SSE Stream

  Client->>API: POST /submissions { problemId, languageId, sourceCode }
  API->>DB: INSERT submissions (status=PENDING)
  DB-->>API: submission { id }
  API->>DB: upsert user_problem_progress (attempts++)
  API->>API: Stream testcases from S3, build N Judge0 payloads<br/>(each payload embeds callback_url with sid + tcid)
  API->>Judge0: POST /submissions/batch (N payloads, one per testcase)
  Judge0-->>API: [{ token₀ }, { token₁ }, ..., { tokenₙ }]
  API->>Redis: HSET submission:{id}:meta { total=N, received=0, problemId }
  API-->>Client: { submissionId }

  Client->>API: GET /submissions/{submissionId}/sse
  API-->>Client: SSE connection established (stream open)

  Note over Judge0: Executes each testcase in sandbox (async, parallel)

  loop for each testcase result (N callbacks)
    Judge0->>API: PUT /submissions/judge0/callback/submit?sid={id}&tcid={index}<br/>body: { token, status, stdout, stderr, time, memory }
    API->>Redis: Lua script (atomic):<br/>1. Dedup by token (SADD seen)<br/>2. Store result at index (HSET resultsI)<br/>3. Increment received (HINCRBY meta)
    Redis-->>API: { added, received, total }
  end

  alt received == total
    API->>Redis: Acquire distributed lock (prevent duplicate finalize)
    API->>BullMQ: Enqueue job { submissionId, isSubmit=true }
  end

  BullMQ->>API: SubmissionFinalizeProcessor.process(job)
  API->>Redis: Read all results (resultsByIndex hash)
  API->>API: Calculate final status (ACCEPTED / WRONG_ANSWER / TLE / MLE / ...)
  API->>DB: UPDATE submissions SET status, passedTestcases, runtimeMs, memoryKb, judgedAt
  API->>DB: UPDATE user_problem_progress (bestSubmission, firstSolvedAt if newly solved)
  API->>DB: UPDATE user_statistics (totalSolved, solvedEasy/Medium/Hard)
  API->>Redis: PUBLISH submission:result:ready { submissionId, payload }
  Redis-->>API: (PubSub delivery to SubmissionSseService subscriber)
  API->>SSE: Forward result event to ReplaySubject stream
  SSE-->>Client: SSE event { status, passedTestcases, runtimeMs, memoryKb, resultDescription }

  opt status == ACCEPTED && first time solving
    API->>DB: INSERT notifications (Problem Solved!)
    API->>API: Emit PROBLEM_SOLVED event → update UserStatistics cache
  end
```

---

## Submission Lifecycle — State Machine

```mermaid
stateDiagram-v2
  direction LR

  [*] --> PENDING : User POSTs code\n(DB record created, Redis tracking init)

  note right of PENDING
    DB stays PENDING throughout async processing.
    N Judge0 callbacks arrive independently.
    Finalizer fires when received == total.
    RUNNING enum value exists for Judge0
    status mapping only — never written to DB.
  end note

  PENDING --> ACCEPTED : All testcases pass\n(Judge0 status=3 across all)

  PENDING --> WRONG_ANSWER : Any testcase output mismatch\n(Judge0 status=4)

  PENDING --> TIME_LIMIT_EXCEEDED : Any testcase exceeds CPU limit\n(Judge0 status=5)

  PENDING --> COMPILATION_ERROR : Compile failed\n(Judge0 status=6)

  PENDING --> MEMORY_LIMIT_EXCEEDED : Any testcase exceeds memory limit\n(Judge0 status=8)

  PENDING --> RUNTIME_ERROR : SIGSEGV / SIGFPE / SIGABRT\n/ NZEC (Judge0 status 7,9–12)

  PENDING --> UNKNOWN_ERROR : Internal / exec format error\n(Judge0 status 13–14)

  ACCEPTED --> [*] : Update DB, progress,\nstatistics, notify user
  WRONG_ANSWER --> [*]
  TIME_LIMIT_EXCEEDED --> [*]
  COMPILATION_ERROR --> [*]
  MEMORY_LIMIT_EXCEEDED --> [*]
  RUNTIME_ERROR --> [*]
  UNKNOWN_ERROR --> [*]

  note right of ACCEPTED
    Side effects (in updateSubmissionAfterJudge):
    • user_problem_progress updated
    • user_statistics updated
    • SSE result pushed via Redis PubSub
    • Contest leaderboard refreshed
    • Notification created (if first solve)
    • AI code review generated (optional)
  end note
```

---

## Database Schema — ERD

Core tables and their relationships. Full history is tracked across **59 migration files**.

```mermaid
erDiagram

  %% ─── AUTH ───────────────────────────────────────────────
  users {
    int id PK
    varchar email UK
    varchar username UK
    varchar password_hash
    varchar full_name
    text avatar_key
    bool is_premium
    timestamptz premium_expires_at
    bool is_banned
    varchar preferred_language
    varchar google_id
    bool email_verified
    int role_id FK
    timestamptz created_at
    timestamptz updated_at
  }

  roles {
    int id PK
    varchar name UK
  }

  permissions {
    int id PK
    varchar name UK
  }

  role_permissions {
    int role_id FK
    int permission_id FK
  }

  refresh_tokens {
    int id PK
    int user_id FK
    varchar token_hash
    timestamptz expires_at
  }

  %% ─── PROBLEMS ────────────────────────────────────────────
  problems {
    int id PK
    varchar title
    varchar slug UK
    text description
    enum difficulty
    bool is_premium
    bool is_active
    bool is_draft
    text testcase_file_key
    int testcase_count
    int time_limit_ms
    int memory_limit_kb
    int total_submissions
    int total_accepted
    decimal acceptance_rate
    jsonb hints
    timestamptz created_at
  }

  topics {
    int id PK
    varchar name UK
  }

  tags {
    int id PK
    varchar name UK
  }

  sample_testcases {
    int id PK
    int problem_id FK
    text input
    text expected_output
    int order_index
  }

  programming_languages {
    int id PK
    varchar name
    varchar slug UK
    int judge0_id
    text harness_code
    text starter_code
  }

  %% ─── SUBMISSIONS ─────────────────────────────────────────
  submissions {
    int id PK
    int user_id FK
    int problem_id FK
    int language_id FK
    int contest_id FK
    text source_code
    enum status
    int passed_testcases
    int total_testcases
    float runtime_ms
    float memory_kb
    jsonb result_description
    text ai_review
    timestamptz submitted_at
    timestamptz judged_at
  }

  user_problem_progress {
    int user_id FK "PK"
    int problem_id FK "PK"
    enum status
    int total_attempts
    int total_accepted
    int best_submission_id FK
    float best_runtime_ms
    float best_memory_kb
    timestamptz first_solved_at
    timestamptz last_attempted_at
  }

  user_statistics {
    int user_id FK "PK"
    decimal global_score
    int total_solved
    int solved_easy
    int solved_medium
    int solved_hard
    int contest_rating
    int contests_participated
    timestamptz last_solve_at
  }

  %% ─── CONTESTS ────────────────────────────────────────────
  contests {
    int id PK
    varchar title
    varchar slug UK
    enum status
    enum ranking_type
    timestamptz start_time
    timestamptz end_time
    int duration_minutes
    int participant_count
  }

  contest_participants {
    int contest_id FK "PK"
    int user_id FK "PK"
    decimal total_score
    int solved_count
    bigint finish_time
    jsonb problem_scores
    int rating_before
    int rating_after
    int rating_delta
  }

  contest_problems {
    int contest_id FK "PK"
    int problem_id FK "PK"
    int points
    int order_index
  }

  %% ─── PAYMENTS ────────────────────────────────────────────
  subscription_plans {
    int id PK
    varchar name
    decimal price_usd
    int duration_days
    bool is_active
  }

  payment_transactions {
    int id PK
    int user_id FK
    int plan_id FK
    decimal amount
    decimal base_price_snapshot
    decimal total_fee_percentage
    varchar currency
    decimal plan_price_vnd
    decimal plan_price_usd
    decimal user_paid_amount
    varchar user_paid_currency
    decimal system_received_amount
    varchar system_received_currency
    decimal system_received_amount_vnd
    decimal system_received_amount_usd
    varchar provider
    varchar transaction_id
    enum status
    timestamptz payment_date
  }

  %% ─── AI INTERVIEWS ───────────────────────────────────────
  ai_interviews {
    uuid id PK
    int user_id FK
    int problem_id
    jsonb problem_snapshot
    enum status
    enum mode
    enum difficulty
    enum personality
    varchar language
    timestamptz scheduled_end_at
    timestamptz started_at
    timestamptz ended_at
  }

  interview_messages {
    int id PK
    uuid interview_id FK
    enum role
    text content
    timestamptz created_at
  }

  interview_evaluations {
    uuid id PK
    uuid interview_id FK
    decimal problem_solving_score
    decimal code_quality_score
    decimal communication_score
    decimal technical_score
    decimal overall_score
    jsonb strengths
    jsonb improvements
    text detailed_feedback
  }

  %% ─── RELATIONSHIPS ───────────────────────────────────────
  users ||--o{ refresh_tokens : "has"
  users }o--|| roles : "assigned"
  roles }o--o{ permissions : "role_permissions"

  problems }o--o{ topics : "problem_topics"
  problems }o--o{ tags : "problem_tags"
  problems ||--o{ sample_testcases : "has"

  submissions }o--|| users : "by"
  submissions }o--|| problems : "for"
  submissions }o--|| programming_languages : "uses"
  submissions }o--o| contests : "in"

  user_problem_progress }o--|| users : "tracks"
  user_problem_progress }o--|| problems : "tracks"
  user_problem_progress }o--o| submissions : "best"
  user_statistics ||--|| users : "belongs to"

  contests ||--o{ contest_problems : "has"
  contests ||--o{ contest_participants : "has"
  contest_problems }o--|| problems : "ref"
  contest_participants }o--|| users : "ref"

  payment_transactions }o--|| users : "by"
  payment_transactions }o--|| subscription_plans : "for"

  ai_interviews }o--|| users : "by"
  ai_interviews ||--o{ interview_messages : "has"
  ai_interviews ||--o| interview_evaluations : "has"
```

---

## Module Breakdown

| Module                   | Responsibility                                                              |
| ------------------------ | --------------------------------------------------------------------------- |
| **auth**                 | JWT login/register, Google OAuth, password reset, email verification        |
| **submissions**          | Code submission pipeline, test run, SSE result streaming, AI code review    |
| **problems**             | CRUD, full-text search, testcase upload to S3, sample testcases             |
| **contest**              | Contest lifecycle, leaderboard (ACM/IOI), ELO rating update                 |
| **ai-interviews**        | AI mock interview sessions, voice via LiveKit, evaluation via Gemini        |
| **ai**                   | LangChain service, prompt config management (DB-driven, no redeploy needed) |
| **payments**             | VNPay integration, subscription management, revenue analytics               |
| **judge0**               | Judge0 HTTP client, callback controller, result parsing                     |
| **rbac**                 | Roles, permissions, CASL ability factory                                    |
| **redis**                | CacheService, PubSubService, LockService, RateLimiterService                |
| **discuss**              | Posts, comments, voting                                                     |
| **solutions**            | Editorial solutions, voting, editorial flag                                 |
| **notifications**        | In-app notifications with i18n (EN/VI)                                      |
| **study-plans**          | Curated problem lists with enrollment tracking                              |
| **favorite-list**        | User-created and saved problem collections                                  |
| **admin**                | Platform statistics dashboard, revenue chart, churn analysis                |
| **programming-language** | Supported languages, Judge0 IDs, harness code templates                     |
| **system-config**        | Runtime system parameters (DB-driven feature flags)                         |

---

## Quick Start

### Prerequisites

- Node.js 18+ or **Bun**
- PostgreSQL 14+
- Redis 7+
- Judge0 instance (self-hosted or cloud)

### 1. Install & configure

```bash
bun install
cp .env.example .env
# Fill in DB_*, JWT_*, JUDGE0_*, AWS_*, REDIS_* variables
```

### 2. Database setup

```bash
createdb sfinx
bun run migration:run   # Run all 59 migrations
bun run seed:run        # Seed roles, languages, problems, plans
```

### 3. Run

```bash
bun run start:dev
```

### Scripts

```bash
bun run migration:run      # Apply pending migrations
bun run migration:revert   # Rollback last migration
bun run seed:run           # Seed reference data
bun run build              # Production build
bun test                   # Unit tests
bun test:e2e               # E2E tests
bun run lint               # ESLint
```

---

## Key Technical Highlights

| #   | Problem                                                             | Solution                                                                                            |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Race condition when multiple Judge0 callbacks arrive simultaneously | **Lua script atomic** (dedup + index store in one Redis transaction) + **RedLock** distributed lock |
| 2   | Real-time submission result delivery without polling                | **SSE** + **Redis Pub/Sub** pipeline                                                                |
| 3   | Large testcase files (thousands of lines)                           | **Streaming JSON parse** (`stream-json`) from S3                                                    |
| 4   | AI interviewer needs to see user's code                             | **Code snapshot mechanism** injected into LLM prompt context                                        |
| 5   | Prevent double-finalization of a submission                         | BullMQ job dedup + distributed lock                                                                 |
| 6   | LLM prompt changes without redeployment                             | **PromptConfig** stored in DB, cached in Redis                                                      |
| 7   | Fine-grained access control (ownership, premium, role)              | **CASL** ability-based authorization + DB-backed role/permission system                             |
| 8   | Contest leaderboard updates in real-time                            | SSE stream + Redis cache invalidation on every accepted submission                                  |
| 9   | Admin churn rate analytics                                          | SQL anti-join with window functions                                                                 |
| 10  | Full schema history and safe migrations                             | 59 **TypeORM migration files** with up/down support                                                 |

---

## Further Reading

- [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) — Full Vietnamese project overview for thesis defence
- [`docs/CASL_RBAC_GUIDE.md`](docs/CASL_RBAC_GUIDE.md) — Authorization system guide
- [`docs/NOTIFICATION_SYSTEM.md`](docs/NOTIFICATION_SYSTEM.md) — Notification architecture
- [`docs/REDIS_USAGE.md`](docs/REDIS_USAGE.md) — Redis usage patterns

---

**License**: UNLICENSED (academic project)

-- =====================================================
-- LEETCODE CLONE - DATABASE SCHEMA DESIGN
-- Senior DBA with 20 years experience
-- Designed for: NestJS + PostgreSQL + TypeORM
-- =====================================================

-- =====================================================
-- SECTION 1: USERS & AUTHENTICATION
-- =====================================================

-- Core user table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable for OAuth users

    -- Profile info
    full_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    website_url VARCHAR(255),
    github_username VARCHAR(100),
    linkedin_url VARCHAR(255),

    -- OAuth integration
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,

    -- Status & verification
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,

    -- Premium subscription
    is_premium BOOLEAN DEFAULT FALSE,
    premium_started_at TIMESTAMPTZ,
    premium_expires_at TIMESTAMPTZ,

    -- Metadata
    last_login_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferred_language VARCHAR(10) DEFAULT 'en',

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_is_premium ON users(is_premium) WHERE is_premium = TRUE;
CREATE INDEX idx_users_created_at ON users(created_at);

-- Refresh tokens for JWT
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token) WHERE is_revoked = FALSE;
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE is_revoked = FALSE;

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token) WHERE used_at IS NULL;

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token) WHERE used_at IS NULL;

-- =====================================================
-- SECTION 2: RBAC (ROLE-BASED ACCESS CONTROL)
-- =====================================================

-- Roles table (Admin, Premium User, Free User, etc.)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE, -- Cannot be deleted
    priority INTEGER DEFAULT 0, -- Higher priority = more permissions in conflicts
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roles_slug ON roles(slug);

-- Add role_id to users
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
CREATE INDEX idx_users_role_id ON users(role_id);

-- Permissions table (granular permissions)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(50) NOT NULL, -- 'problem', 'contest', 'submission', etc.
    action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete', 'join', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_permission UNIQUE(resource, action)
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- Role-Permission mapping (many-to-many)
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- =====================================================
-- SECTION 3: PROBLEMS & TOPICS
-- =====================================================

-- Topics (like LeetCode: Array, String, Tree, Graph, etc.)
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_slug ON topics(slug);
CREATE INDEX idx_topics_order ON topics(order_index);

-- Companies (like LeetCode shows which company asked this)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    website_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_slug ON companies(slug);

-- Main problems table
CREATE TABLE problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    problem_number INTEGER UNIQUE, -- Like LeetCode: 1, 2, 3...

    -- Content (stored as JSON for flexibility with different formats)
    description TEXT NOT NULL, -- Markdown format
    description_html TEXT, -- Pre-rendered HTML
    constraints TEXT, -- Input constraints

    -- Difficulty
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),

    -- Access control
    is_premium BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Stats (denormalized for performance)
    total_submissions INTEGER DEFAULT 0,
    total_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 0.00, -- Calculated: (accepted/submissions * 100)
    total_attempts INTEGER DEFAULT 0, -- Number of users who attempted
    total_solved INTEGER DEFAULT 0, -- Number of users who solved

    -- Difficulty stats (for rating adjustment)
    average_time_to_solve INTEGER, -- In seconds
    difficulty_rating DECIMAL(4,2), -- Community-based difficulty (1-10)

    -- Code templates (JSON for multiple languages)
    code_templates JSONB DEFAULT '{}', -- { "python": "def solution():", "cpp": "class Solution {", ... }

    -- Hints system (like LeetCode progressive hints)
    hints JSONB DEFAULT '[]', -- Array of hint objects: [{ "order": 1, "content": "Think about..." }]

    -- Solution
    has_official_solution BOOLEAN DEFAULT FALSE,
    official_solution_content TEXT, -- Markdown

    -- Metadata
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- For similar problems feature
    similar_problems UUID[] DEFAULT ARRAY[]::UUID[]
);

CREATE INDEX idx_problems_slug ON problems(slug);
CREATE INDEX idx_problems_number ON problems(problem_number);
CREATE INDEX idx_problems_difficulty ON problems(difficulty);
CREATE INDEX idx_problems_is_premium ON problems(is_premium);
CREATE INDEX idx_problems_is_published ON problems(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_problems_acceptance_rate ON problems(acceptance_rate);
CREATE INDEX idx_problems_created_at ON problems(created_at DESC);

-- Problem-Topic mapping (many-to-many)
CREATE TABLE problem_topics (
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,

    PRIMARY KEY (problem_id, topic_id)
);

CREATE INDEX idx_problem_topics_problem ON problem_topics(problem_id);
CREATE INDEX idx_problem_topics_topic ON problem_topics(topic_id);

-- Problem-Company mapping (which company asked this)
CREATE TABLE problem_companies (
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    frequency INTEGER DEFAULT 1, -- How often this company asks this
    last_asked_date DATE,

    PRIMARY KEY (problem_id, company_id)
);

CREATE INDEX idx_problem_companies_problem ON problem_companies(problem_id);
CREATE INDEX idx_problem_companies_company ON problem_companies(company_id);
CREATE INDEX idx_problem_companies_frequency ON problem_companies(frequency DESC);

-- Tags (more flexible than topics - like "Two Pointers", "Sliding Window")
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50), -- 'technique', 'pattern', 'data-structure', 'algorithm'
    description TEXT,
    color VARCHAR(7), -- Hex color for UI
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_type ON tags(type);

-- Problem-Tag mapping
CREATE TABLE problem_tags (
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    PRIMARY KEY (problem_id, tag_id)
);

CREATE INDEX idx_problem_tags_problem ON problem_tags(problem_id);
CREATE INDEX idx_problem_tags_tag ON problem_tags(tag_id);

-- =====================================================
-- SECTION 4: TEST CASES
-- =====================================================

CREATE TABLE testcases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,

    -- Input/Output
    input TEXT NOT NULL, -- JSON string or plain text
    expected_output TEXT NOT NULL,

    -- Constraints
    time_limit_ms INTEGER DEFAULT 2000, -- 2 seconds default
    memory_limit_mb INTEGER DEFAULT 256, -- 256MB default

    -- Visibility
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden testcases for submission validation
    is_sample BOOLEAN DEFAULT FALSE, -- Shown as example in problem

    -- Metadata
    order_index INTEGER DEFAULT 0,
    explanation TEXT, -- Why this testcase is important

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_testcases_problem ON testcases(problem_id);
CREATE INDEX idx_testcases_is_sample ON testcases(problem_id, is_sample) WHERE is_sample = TRUE;
CREATE INDEX idx_testcases_order ON testcases(problem_id, order_index);

-- =====================================================
-- SECTION 5: SUBMISSIONS & JUDGE
-- =====================================================

-- Programming languages supported
CREATE TABLE programming_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- 'Python', 'C++', 'Java', etc.
    slug VARCHAR(50) UNIQUE NOT NULL,
    judge0_id INTEGER, -- Judge0 language ID
    monaco_language VARCHAR(50), -- Monaco editor language identifier
    is_active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_languages_slug ON programming_languages(slug);
CREATE INDEX idx_languages_judge0 ON programming_languages(judge0_id);

-- Main submissions table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    language_id UUID NOT NULL REFERENCES programming_languages(id),
    contest_id UUID REFERENCES contests(id) ON DELETE SET NULL, -- If submitted in contest

    -- Code
    code TEXT NOT NULL,
    code_length INTEGER, -- For stats

    -- Verdict
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    -- Pending, Judging, Accepted, Wrong Answer, Time Limit Exceeded,
    -- Memory Limit Exceeded, Runtime Error, Compilation Error, etc.

    -- Execution results
    passed_testcases INTEGER DEFAULT 0,
    total_testcases INTEGER DEFAULT 0,

    -- Performance metrics (best case among all testcases)
    runtime_ms INTEGER, -- Execution time in milliseconds
    memory_kb INTEGER, -- Memory used in KB

    -- Detailed results (JSON array of testcase results)
    testcase_results JSONB DEFAULT '[]',
    -- [{ "testcase_id": "uuid", "status": "Accepted", "runtime_ms": 10, "memory_kb": 1024, "output": "..." }]

    -- Judge0 integration
    judge0_token VARCHAR(255), -- For polling Judge0 results

    -- Error details
    error_message TEXT,
    error_line INTEGER,
    compile_output TEXT,

    -- Submission metadata
    ip_address INET,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    judged_at TIMESTAMPTZ,

    -- For contest scoring
    penalty_time INTEGER DEFAULT 0, -- In minutes (for wrong attempts)
    is_after_contest BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_submissions_user ON submissions(user_id);
CREATE INDEX idx_submissions_problem ON submissions(problem_id);
CREATE INDEX idx_submissions_contest ON submissions(contest_id) WHERE contest_id IS NOT NULL;
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX idx_submissions_user_problem ON submissions(user_id, problem_id);
CREATE INDEX idx_submissions_user_status ON submissions(user_id, status) WHERE status = 'Accepted';

-- User problem attempts tracking (denormalized for performance)
CREATE TABLE user_problem_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Attempted',
    -- 'Attempted', 'Solved', 'Attempted-Unsolved'

    -- Stats
    total_attempts INTEGER DEFAULT 0,
    total_accepted INTEGER DEFAULT 0,

    -- Best submission
    best_submission_id UUID REFERENCES submissions(id),
    best_runtime_ms INTEGER,
    best_memory_kb INTEGER,

    -- Timing
    first_attempted_at TIMESTAMPTZ DEFAULT NOW(),
    first_solved_at TIMESTAMPTZ,
    last_attempted_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, problem_id)
);

CREATE INDEX idx_user_progress_user ON user_problem_progress(user_id);
CREATE INDEX idx_user_progress_status ON user_problem_progress(user_id, status);
CREATE INDEX idx_user_progress_solved ON user_problem_progress(user_id) WHERE status = 'Solved';

-- =====================================================
-- SECTION 6: CONTESTS
-- =====================================================

CREATE TABLE contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    rules TEXT, -- Contest-specific rules

    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL, -- For virtual contests

    -- Access control
    is_public BOOLEAN DEFAULT TRUE,
    is_rated BOOLEAN DEFAULT FALSE, -- Affects user rating
    is_virtual_available BOOLEAN DEFAULT TRUE, -- Can participate after end
    requires_premium BOOLEAN DEFAULT FALSE,

    -- Registration
    registration_opens_at TIMESTAMPTZ,
    registration_closes_at TIMESTAMPTZ,
    max_participants INTEGER, -- NULL = unlimited

    -- Scoring
    scoring_rule VARCHAR(50) DEFAULT 'ICPC',
    -- ICPC: (problems_solved, -penalty_time)
    -- IOI: sum of points
    -- Custom: JSON configuration
    scoring_config JSONB DEFAULT '{}',

    -- Stats (denormalized)
    total_participants INTEGER DEFAULT 0,
    total_submissions INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_registration CHECK (
        registration_closes_at IS NULL OR
        registration_closes_at <= start_time
    )
);

CREATE INDEX idx_contests_slug ON contests(slug);
CREATE INDEX idx_contests_start_time ON contests(start_time);
CREATE INDEX idx_contests_status ON contests(start_time, end_time); -- For filtering ongoing/upcoming
CREATE INDEX idx_contests_is_public ON contests(is_public) WHERE is_public = TRUE;

-- Contest problems (with points/order)
CREATE TABLE contest_problems (
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,

    order_index INTEGER NOT NULL, -- A, B, C, D...
    points INTEGER NOT NULL DEFAULT 100, -- Points for solving

    -- Stats
    total_attempts INTEGER DEFAULT 0,
    total_accepted INTEGER DEFAULT 0,

    PRIMARY KEY (contest_id, problem_id)
);

CREATE INDEX idx_contest_problems_contest ON contest_problems(contest_id);
CREATE INDEX idx_contest_problems_problem ON contest_problems(problem_id);
CREATE INDEX idx_contest_problems_order ON contest_problems(contest_id, order_index);

-- Contest participants
CREATE TABLE contest_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Registration
    registered_at TIMESTAMPTZ DEFAULT NOW(),

    -- Participation
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    is_virtual BOOLEAN DEFAULT FALSE, -- Virtual participation after contest

    -- Score & rank (denormalized for leaderboard performance)
    score INTEGER DEFAULT 0,
    penalty_time INTEGER DEFAULT 0, -- In minutes (for ICPC)
    problems_solved INTEGER DEFAULT 0,
    rank INTEGER,

    -- Metadata
    last_submission_at TIMESTAMPTZ,

    CONSTRAINT unique_participant UNIQUE(contest_id, user_id)
);

CREATE INDEX idx_participants_contest ON contest_participants(contest_id);
CREATE INDEX idx_participants_user ON contest_participants(user_id);
CREATE INDEX idx_participants_leaderboard ON contest_participants(contest_id, score DESC, penalty_time ASC);
CREATE INDEX idx_participants_rank ON contest_participants(contest_id, rank);

-- Contest problem attempts (for detailed stats)
CREATE TABLE contest_problem_attempts (
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES contest_participants(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,

    -- Attempts
    total_attempts INTEGER DEFAULT 0,
    accepted_attempts INTEGER DEFAULT 0,
    wrong_attempts INTEGER DEFAULT 0,

    -- Scoring
    points INTEGER DEFAULT 0,
    penalty_time INTEGER DEFAULT 0, -- Wrong submission penalty

    -- Timing
    first_attempt_at TIMESTAMPTZ,
    first_accepted_at TIMESTAMPTZ,

    -- Best submission
    best_submission_id UUID REFERENCES submissions(id),

    PRIMARY KEY (contest_id, participant_id, problem_id)
);

CREATE INDEX idx_contest_attempts_participant ON contest_problem_attempts(participant_id);
CREATE INDEX idx_contest_attempts_problem ON contest_problem_attempts(problem_id);

-- =====================================================
-- SECTION 7: PAYMENTS & SUBSCRIPTIONS
-- =====================================================

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,

    -- Pricing
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'VND',

    -- Features (JSON for flexibility)
    features JSONB DEFAULT '[]',
    -- ["Access to all premium problems", "AI Interview unlimited", "Ad-free"]

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- Display order
    order_index INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plans_slug ON subscription_plans(slug);
CREATE INDEX idx_plans_active ON subscription_plans(is_active) WHERE is_active = TRUE;

-- User subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),

    -- Subscription period
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,

    -- Billing
    billing_cycle VARCHAR(20) NOT NULL, -- 'monthly', 'yearly'
    amount_paid DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    -- Active, Cancelled, Expired, Suspended

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,

    -- Auto-renewal
    auto_renew BOOLEAN DEFAULT TRUE,
    next_billing_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date) WHERE status = 'Active';

-- Payment transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),

    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',

    -- Payment gateway (VNPay)
    payment_method VARCHAR(50) NOT NULL, -- 'vnpay', 'momo', 'card'
    vnpay_transaction_ref VARCHAR(255) UNIQUE, -- VNPay TxnRef
    vnpay_transaction_no VARCHAR(255), -- VNPay TransactionNo
    vnpay_bank_code VARCHAR(50),
    vnpay_card_type VARCHAR(50),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    -- Pending, Processing, Success, Failed, Refunded

    -- Response from payment gateway
    payment_response JSONB,

    -- Metadata
    ip_address INET,
    user_agent TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,

    -- Refund
    refund_amount DECIMAL(10,2),
    refund_reason TEXT
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_subscription ON transactions(subscription_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_vnpay_ref ON transactions(vnpay_transaction_ref);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Payment logs (for debugging)
CREATE TABLE payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,

    event_type VARCHAR(50) NOT NULL, -- 'ipn_received', 'payment_redirect', 'webhook'
    payload JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_logs_transaction ON payment_logs(transaction_id);
CREATE INDEX idx_payment_logs_created ON payment_logs(created_at DESC);

-- =====================================================
-- SECTION 8: AI FEATURES
-- =====================================================

-- AI providers configuration (OpenAI, Gemini, etc.)
CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL, -- 'OpenAI', 'Gemini', 'Claude'
    slug VARCHAR(100) UNIQUE NOT NULL,

    -- Configuration
    api_key_encrypted TEXT, -- Encrypted API key
    base_url VARCHAR(255),
    default_model VARCHAR(100),

    -- Available models
    models JSONB DEFAULT '[]',
    -- [{ "name": "gpt-4", "max_tokens": 8000, "cost_per_1k_tokens": 0.03 }]

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Higher priority used first

    -- Rate limiting
    rate_limit_per_minute INTEGER,
    rate_limit_per_day INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_providers_slug ON ai_providers(slug);
CREATE INDEX idx_ai_providers_active ON ai_providers(is_active, priority DESC);

-- AI usage logs (for cost tracking)
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES ai_providers(id),

    -- Request details
    model VARCHAR(100) NOT NULL,
    feature VARCHAR(50) NOT NULL, -- 'interview', 'hint', 'explanation'

    -- Token usage
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,

    -- Cost calculation
    cost_usd DECIMAL(10,6),

    -- Performance
    latency_ms INTEGER,

    -- Request/Response (for debugging)
    request_summary TEXT, -- Short summary, not full prompt
    response_summary TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_logs_user ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_logs_provider ON ai_usage_logs(provider_id);
CREATE INDEX idx_ai_logs_feature ON ai_usage_logs(feature);
CREATE INDEX idx_ai_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_logs_cost ON ai_usage_logs(cost_usd DESC) WHERE cost_usd > 0;

-- AI Interview sessions
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id),

    -- Session data
    messages JSONB DEFAULT '[]', -- Array of chat messages
    -- [{ "role": "user"|"assistant", "content": "...", "timestamp": "..." }]

    code_snapshots JSONB DEFAULT '[]', -- Code at different timestamps
    -- [{ "timestamp": "...", "code": "...", "language": "..." }]

    -- Session state
    status VARCHAR(50) DEFAULT 'Active',
    -- Active, Completed, Abandoned

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,

    -- AI Evaluation (filled after completion)
    evaluation JSONB,
    -- {
    --   "problem_understanding": 8,
    --   "approach": 7,
    --   "code_quality": 9,
    --   "communication": 8,
    --   "overall_score": 8,
    --   "feedback": "...",
    --   "strengths": [...],
    --   "areas_for_improvement": [...]
    -- }

    -- Metadata
    provider_id UUID REFERENCES ai_providers(id),
    total_ai_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,6)
);

CREATE INDEX idx_interviews_user ON interview_sessions(user_id);
CREATE INDEX idx_interviews_problem ON interview_sessions(problem_id);
CREATE INDEX idx_interviews_status ON interview_sessions(status);
CREATE INDEX idx_interviews_started ON interview_sessions(started_at DESC);

-- AI hints given during problem solving
CREATE TABLE ai_hint_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id),

    -- Request context
    current_code TEXT,
    language_id UUID REFERENCES programming_languages(id),

    -- AI response
    hint_content TEXT NOT NULL,
    provider_id UUID REFERENCES ai_providers(id),
    tokens_used INTEGER,

    -- Feedback
    was_helpful BOOLEAN, -- User can rate

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hints_user ON ai_hint_requests(user_id);
CREATE INDEX idx_hints_problem ON ai_hint_requests(problem_id);
CREATE INDEX idx_hints_created ON ai_hint_requests(created_at DESC);

-- =====================================================
-- SECTION 9: COMMUNITY FEATURES
-- =====================================================

-- Discussion/Solution posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id),

    -- Post type
    type VARCHAR(50) NOT NULL, -- 'solution', 'discussion', 'question'

    -- Content
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT, -- Pre-rendered HTML

    -- Code (for solutions)
    code TEXT,
    language_id UUID REFERENCES programming_languages(id),

    -- Engagement
    view_count INTEGER DEFAULT 0,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,

    -- Moderation
    is_published BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE, -- Featured solutions
    is_official BOOLEAN DEFAULT FALSE, -- Official solution
    is_locked BOOLEAN DEFAULT FALSE, -- No more comments

    -- Tags
    tags VARCHAR(100)[], -- Additional tags

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_problem ON posts(problem_id);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_published ON posts(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_posts_featured ON posts(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_posts_upvotes ON posts(upvotes DESC);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- Comments (nested, threaded discussions)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Can comment on posts or problems directly
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Nested comments
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    content_html TEXT,

    -- Engagement
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,

    -- Moderation
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_parent CHECK (
        (post_id IS NOT NULL AND problem_id IS NULL) OR
        (post_id IS NULL AND problem_id IS NOT NULL)
    )
);

CREATE INDEX idx_comments_post ON comments(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_comments_problem ON comments(problem_id) WHERE problem_id IS NOT NULL;
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- Votes (for posts and comments)
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Can vote on posts or comments
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_vote UNIQUE (user_id, post_id, comment_id),
    CONSTRAINT valid_vote_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_post ON votes(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_votes_comment ON votes(comment_id) WHERE comment_id IS NOT NULL;

-- =====================================================
-- SECTION 10: LEARNING PATHS & COURSES
-- =====================================================

-- Learning paths (curated problem sequences)
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cover_image_url TEXT,

    -- Difficulty & Prerequisites
    difficulty VARCHAR(20), -- Beginner, Intermediate, Advanced
    prerequisites TEXT[], -- Array of prerequisite course slugs

    -- Stats
    estimated_hours INTEGER,
    total_problems INTEGER DEFAULT 0,
    total_chapters INTEGER DEFAULT 0,
    enrolled_count INTEGER DEFAULT 0,

    -- Access
    is_premium BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_slug ON courses(slug);
CREATE INDEX idx_courses_difficulty ON courses(difficulty);
CREATE INDEX idx_courses_published ON courses(is_published) WHERE is_published = TRUE;

-- Course chapters
CREATE TABLE course_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    order_index INTEGER NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chapters_course ON course_chapters(course_id);
CREATE INDEX idx_chapters_order ON course_chapters(course_id, order_index);

-- Chapter items (problems, readings, videos)
CREATE TABLE course_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES course_chapters(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL, -- 'problem', 'article', 'video', 'quiz'

    -- For problems
    problem_id UUID REFERENCES problems(id),

    -- For articles/readings
    title VARCHAR(255),
    content TEXT,
    content_html TEXT,

    -- For videos
    video_url TEXT,
    video_duration_seconds INTEGER,

    -- Order
    order_index INTEGER NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_chapter ON course_items(chapter_id);
CREATE INDEX idx_items_problem ON course_items(problem_id) WHERE problem_id IS NOT NULL;
CREATE INDEX idx_items_order ON course_items(chapter_id, order_index);

-- User course progress
CREATE TABLE user_course_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    -- Progress
    completed_items INTEGER DEFAULT 0,
    total_items INTEGER,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,

    -- Status
    status VARCHAR(50) DEFAULT 'In Progress',
    -- 'Not Started', 'In Progress', 'Completed'

    -- Timing
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,

    PRIMARY KEY (user_id, course_id)
);

CREATE INDEX idx_user_course_progress_user ON user_course_progress(user_id);
CREATE INDEX idx_user_course_progress_status ON user_course_progress(user_id, status);

-- =====================================================
-- SECTION 11: USER STATISTICS & ACHIEVEMENTS
-- =====================================================

-- Daily coding activity (for heatmap like GitHub)
CREATE TABLE user_daily_activities (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,

    -- Activity counts
    problems_attempted INTEGER DEFAULT 0,
    problems_solved INTEGER DEFAULT 0,
    submissions_count INTEGER DEFAULT 0,
    accepted_submissions INTEGER DEFAULT 0,

    -- Time spent (in minutes)
    time_spent_minutes INTEGER DEFAULT 0,

    PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX idx_activities_user_date ON user_daily_activities(user_id, activity_date DESC);

-- User statistics (denormalized for performance)
CREATE TABLE user_statistics (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Problem solving stats
    total_problems_attempted INTEGER DEFAULT 0,
    total_problems_solved INTEGER DEFAULT 0,

    easy_solved INTEGER DEFAULT 0,
    medium_solved INTEGER DEFAULT 0,
    hard_solved INTEGER DEFAULT 0,

    -- Submission stats
    total_submissions INTEGER DEFAULT 0,
    accepted_submissions INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 0.00,

    -- Contest stats
    contests_participated INTEGER DEFAULT 0,
    contest_rating INTEGER DEFAULT 1500, -- ELO-like rating
    max_contest_rating INTEGER DEFAULT 1500,
    contest_ranking INTEGER,

    -- Streaks
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,

    -- Activity
    total_time_spent_minutes INTEGER DEFAULT 0,
    last_activity_date DATE,

    -- Rankings
    global_ranking INTEGER,
    country_ranking INTEGER,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stats_solved ON user_statistics(total_problems_solved DESC);
CREATE INDEX idx_stats_rating ON user_statistics(contest_rating DESC);
CREATE INDEX idx_stats_ranking ON user_statistics(global_ranking);

-- Achievements/Badges
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,

    -- Badge appearance
    icon_url TEXT,
    color VARCHAR(7),
    tier VARCHAR(20), -- 'bronze', 'silver', 'gold', 'platinum'

    -- Unlock criteria (JSON for flexibility)
    criteria JSONB NOT NULL,
    -- { "type": "problems_solved", "value": 100, "difficulty": "Hard" }
    -- { "type": "contest_wins", "value": 5 }
    -- { "type": "streak", "value": 30 }

    -- Rarity
    rarity_score INTEGER DEFAULT 0, -- 0-100, higher = rarer

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_achievements_slug ON achievements(slug);
CREATE INDEX idx_achievements_tier ON achievements(tier);

-- User achievements
CREATE TABLE user_achievements (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,

    unlocked_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_unlocked ON user_achievements(unlocked_at DESC);

-- =====================================================
-- SECTION 12: NOTIFICATIONS & MESSAGING
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification type
    type VARCHAR(50) NOT NULL,
    -- 'contest_starting', 'comment_reply', 'solution_upvoted',
    -- 'achievement_unlocked', 'premium_expiring', etc.

    -- Content
    title VARCHAR(255) NOT NULL,
    message TEXT,

    -- Related entities (for deep linking)
    related_entity_type VARCHAR(50), -- 'problem', 'contest', 'post', etc.
    related_entity_id UUID,

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Email queue (for async email sending)
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Email details
    subject VARCHAR(500) NOT NULL,
    body_text TEXT NOT NULL,
    body_html TEXT,

    -- Template
    template_name VARCHAR(100),
    template_data JSONB,

    -- Status
    status VARCHAR(50) DEFAULT 'Pending',
    -- Pending, Sent, Failed, Bounced

    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    error_message TEXT,

    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ
);

CREATE INDEX idx_email_queue_status ON email_queue(status) WHERE status = 'Pending';
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'Pending';

-- =====================================================
-- SECTION 13: ADMIN & MODERATION
-- =====================================================

-- Reported content
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What is being reported
    reported_entity_type VARCHAR(50) NOT NULL, -- 'post', 'comment', 'user'
    reported_entity_id UUID NOT NULL,

    -- Report details
    reason VARCHAR(50) NOT NULL,
    -- 'spam', 'offensive', 'incorrect_solution', 'harassment', 'other'

    description TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'Pending',
    -- Pending, Under Review, Resolved, Dismissed

    -- Resolution
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    action_taken VARCHAR(100), -- 'content_removed', 'user_warned', 'no_action', etc.

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_entity ON reports(reported_entity_type, reported_entity_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created ON reports(created_at DESC);

-- Audit logs (for tracking admin actions)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Action details
    action VARCHAR(100) NOT NULL, -- 'user_banned', 'problem_deleted', etc.
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Changes
    old_values JSONB,
    new_values JSONB,

    -- Metadata
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================
-- SECTION 14: SYSTEM CONFIGURATION
-- =====================================================

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Can be read by non-admin users
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contests_updated_at BEFORE UPDATE ON contests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate problem acceptance rate
CREATE OR REPLACE FUNCTION update_problem_acceptance_rate()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE problems
    SET acceptance_rate = CASE
        WHEN total_submissions > 0 THEN
            ROUND((total_accepted::DECIMAL / total_submissions * 100), 2)
        ELSE 0
    END
    WHERE id = NEW.problem_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_acceptance_rate AFTER INSERT OR UPDATE ON submissions
    FOR EACH ROW
    WHEN (NEW.status = 'Accepted')
    EXECUTE FUNCTION update_problem_acceptance_rate();

-- =====================================================
-- INITIAL DATA SEEDS
-- =====================================================

-- Default roles
INSERT INTO roles (name, slug, description, is_system_role, priority) VALUES
    ('Admin', 'admin', 'Full system access', TRUE, 100),
    ('Premium User', 'premium', 'Paid subscriber with premium features', TRUE, 50),
    ('Free User', 'free', 'Basic free account', TRUE, 10);

-- Default permissions
INSERT INTO permissions (resource, action, description) VALUES
    -- Problems
    ('problem', 'create', 'Create new problems'),
    ('problem', 'read', 'View problems'),
    ('problem', 'update', 'Edit problems'),
    ('problem', 'delete', 'Delete problems'),
    ('problem', 'read_premium', 'View premium problems'),

    -- Submissions
    ('submission', 'create', 'Submit solutions'),
    ('submission', 'read', 'View own submissions'),
    ('submission', 'read_all', 'View all submissions'),

    -- Contests
    ('contest', 'create', 'Create contests'),
    ('contest', 'read', 'View contests'),
    ('contest', 'update', 'Edit contests'),
    ('contest', 'delete', 'Delete contests'),
    ('contest', 'join', 'Join contests'),
    ('contest', 'join_premium', 'Join premium contests'),

    -- Users
    ('user', 'read', 'View user profiles'),
    ('user', 'update', 'Edit user profiles'),
    ('user', 'ban', 'Ban users'),
    ('user', 'delete', 'Delete users'),

    -- Admin
    ('admin', 'access', 'Access admin panel'),
    ('admin', 'roles', 'Manage roles and permissions'),
    ('admin', 'statistics', 'View system statistics'),

    -- AI Features
    ('ai', 'interview', 'Use AI interview feature'),
    ('ai', 'hint', 'Get AI hints'),
    ('ai', 'unlimited', 'Unlimited AI usage'),

    -- Community
    ('post', 'create', 'Create posts/solutions'),
    ('post', 'update', 'Edit posts'),
    ('post', 'delete', 'Delete posts'),
    ('comment', 'create', 'Comment on posts'),
    ('comment', 'delete', 'Delete comments'),

    -- Payment
    ('payment', 'create', 'Make payments');

-- Programming languages
INSERT INTO programming_languages (name, slug, judge0_id, monaco_language, order_index) VALUES
    ('Python 3', 'python3', 71, 'python', 1),
    ('C++', 'cpp', 54, 'cpp', 2),
    ('Java', 'java', 62, 'java', 3),
    ('JavaScript', 'javascript', 63, 'javascript', 4),
    ('TypeScript', 'typescript', 74, 'typescript', 5),
    ('C', 'c', 50, 'c', 6),
    ('C#', 'csharp', 51, 'csharp', 7),
    ('Ruby', 'ruby', 72, 'ruby', 8),
    ('Go', 'go', 60, 'go', 9),
    ('Rust', 'rust', 73, 'rust', 10),
    ('Swift', 'swift', 83, 'swift', 11),
    ('Kotlin', 'kotlin', 78, 'kotlin', 12);

-- Sample topics (like LeetCode)
INSERT INTO topics (name, slug, order_index) VALUES
    ('Array', 'array', 1),
    ('String', 'string', 2),
    ('Hash Table', 'hash-table', 3),
    ('Dynamic Programming', 'dynamic-programming', 4),
    ('Math', 'math', 5),
    ('Sorting', 'sorting', 6),
    ('Greedy', 'greedy', 7),
    ('Depth-First Search', 'depth-first-search', 8),
    ('Binary Search', 'binary-search', 9),
    ('Database', 'database', 10),
    ('Breadth-First Search', 'breadth-first-search', 11),
    ('Tree', 'tree', 12),
    ('Matrix', 'matrix', 13),
    ('Two Pointers', 'two-pointers', 14),
    ('Binary Tree', 'binary-tree', 15),
    ('Bit Manipulation', 'bit-manipulation', 16),
    ('Stack', 'stack', 17),
    ('Heap (Priority Queue)', 'heap', 18),
    ('Graph', 'graph', 19),
    ('Simulation', 'simulation', 20),
    ('Design', 'design', 21),
    ('Prefix Sum', 'prefix-sum', 22),
    ('Backtracking', 'backtracking', 23),
    ('Linked List', 'linked-list', 24),
    ('Sliding Window', 'sliding-window', 25);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- User progress summary view
CREATE VIEW user_progress_summary AS
SELECT
    u.id as user_id,
    u.username,
    COUNT(DISTINCT CASE WHEN upp.status = 'Solved' THEN upp.problem_id END) as total_solved,
    COUNT(DISTINCT CASE WHEN upp.status = 'Solved' AND p.difficulty = 'Easy' THEN upp.problem_id END) as easy_solved,
    COUNT(DISTINCT CASE WHEN upp.status = 'Solved' AND p.difficulty = 'Medium' THEN upp.problem_id END) as medium_solved,
    COUNT(DISTINCT CASE WHEN upp.status = 'Solved' AND p.difficulty = 'Hard' THEN upp.problem_id END) as hard_solved,
    COUNT(DISTINCT s.id) as total_submissions,
    COUNT(DISTINCT CASE WHEN s.status = 'Accepted' THEN s.id END) as accepted_submissions,
    CASE
        WHEN COUNT(DISTINCT s.id) > 0 THEN
            ROUND((COUNT(DISTINCT CASE WHEN s.status = 'Accepted' THEN s.id END)::DECIMAL / COUNT(DISTINCT s.id) * 100), 2)
        ELSE 0
    END as acceptance_rate
FROM users u
LEFT JOIN user_problem_progress upp ON u.id = upp.user_id
LEFT JOIN problems p ON upp.problem_id = p.id
LEFT JOIN submissions s ON u.id = s.user_id
GROUP BY u.id, u.username;

-- Contest leaderboard view
CREATE VIEW contest_leaderboard AS
SELECT
    cp.contest_id,
    cp.user_id,
    u.username,
    u.avatar_url,
    cp.rank,
    cp.score,
    cp.penalty_time,
    cp.problems_solved,
    c.scoring_rule
FROM contest_participants cp
JOIN users u ON cp.user_id = u.id
JOIN contests c ON cp.contest_id = c.id
WHERE NOT cp.is_virtual
ORDER BY cp.contest_id, cp.rank;

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX idx_problems_difficulty_premium ON problems(difficulty, is_premium, is_published);
CREATE INDEX idx_submissions_user_problem_status ON submissions(user_id, problem_id, status);
CREATE INDEX idx_user_progress_user_status ON user_problem_progress(user_id, status);

-- Partial indexes for active records
CREATE INDEX idx_active_contests ON contests(start_time, end_time)
    WHERE is_public = TRUE AND is_published = TRUE;

CREATE INDEX idx_active_users ON users(last_active_at DESC)
    WHERE is_active = TRUE AND is_banned = FALSE;

-- =====================================================
-- COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Core user accounts with authentication and profile data';
COMMENT ON TABLE problems IS 'Coding problems similar to LeetCode structure';
COMMENT ON TABLE submissions IS 'Code submissions with Judge0 integration';
COMMENT ON TABLE contests IS 'Programming contests with leaderboards';
COMMENT ON TABLE interview_sessions IS 'AI-powered mock interview sessions';
COMMENT ON TABLE transactions IS 'Payment transactions via VNPay';

-- =====================================================
-- SECURITY: ROW LEVEL SECURITY (RLS) - Optional
-- =====================================================

-- Enable RLS on sensitive tables (uncomment if needed)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- BACKUP & MAINTENANCE NOTES
-- =====================================================

/*
RECOMMENDED MAINTENANCE TASKS:

1. Daily:
   - VACUUM ANALYZE on submissions, user_problem_progress
   - Clear old refresh_tokens (> 30 days old)
   - Process email_queue pending items

2. Weekly:
   - Rebuild acceptance_rate for all problems
   - Update global rankings in user_statistics
   - Archive old audit_logs (> 90 days)

3. Monthly:
   - Full VACUUM on large tables
   - Check and rebuild degraded indexes
   - Review and optimize slow queries

BACKUP STRATEGY:
   - Daily full backup (automated)
   - Hourly incremental backups
   - Keep 30 days of backups
   - Test restore monthly
*/

-- =====================================================
-- END OF SCHEMA
-- =====================================================

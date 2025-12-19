import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1734325000000 implements MigrationInterface {
  name = 'InitialSchema1734325000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE "problem_difficulty_enum" AS ENUM ('Easy', 'Medium', 'Hard')
    `);

    await queryRunner.query(`
      CREATE TYPE "submission_status_enum" AS ENUM (
        'Pending',
        'Judging',
        'Accepted',
        'Wrong Answer',
        'Time Limit Exceeded',
        'Memory Limit Exceeded',
        'Runtime Error',
        'Compilation Error',
        'Internal Error'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "progress_status_enum" AS ENUM ('Attempted', 'Solved', 'Attempted-Unsolved')
    `);

    // ==================== RBAC TABLES ====================

    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" SERIAL NOT NULL,
        "resource" VARCHAR(100) NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_resource_action" UNIQUE ("resource", "action")
      )
    `);

    // Create roles table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" SERIAL NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "slug" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "is_system_role" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_name" UNIQUE ("name"),
        CONSTRAINT "UQ_roles_slug" UNIQUE ("slug")
      )
    `);

    // Create role_permissions junction table
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" INTEGER NOT NULL,
        "permission_id" INTEGER NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id")
          REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_role" ON "role_permissions" ("role_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_permission" ON "role_permissions" ("permission_id")
    `);

    // ==================== AUTH TABLES ====================

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "username" VARCHAR(50) NOT NULL,
        "password_hash" VARCHAR(255),
        "full_name" VARCHAR(255),
        "avatar_url" TEXT,
        "bio" TEXT,
        "github_url" VARCHAR(255),
        "linkedin_url" VARCHAR(255),
        "website_url" VARCHAR(255),
        "location" VARCHAR(100),
        "company" VARCHAR(100),
        "role_id" INTEGER,
        "email_verified" BOOLEAN NOT NULL DEFAULT false,
        "email_verified_at" TIMESTAMPTZ,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "is_banned" BOOLEAN NOT NULL DEFAULT false,
        "ban_reason" TEXT,
        "banned_at" TIMESTAMPTZ,
        "is_premium" BOOLEAN NOT NULL DEFAULT false,
        "premium_start_date" TIMESTAMPTZ,
        "premium_end_date" TIMESTAMPTZ,
        "oauth_provider" VARCHAR(50),
        "oauth_provider_id" VARCHAR(255),
        "google_id" VARCHAR(255),
        "github_id" VARCHAR(255),
        "last_login_at" TIMESTAMPTZ,
        "last_active_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id"),
        CONSTRAINT "UQ_users_github_id" UNIQUE ("github_id"),
        CONSTRAINT "FK_users_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_username" ON "users" ("username")
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" SERIAL NOT NULL,
        "user_id" INTEGER NOT NULL,
        "jti" UUID NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "is_revoked" BOOLEAN NOT NULL DEFAULT false,
        "revoked_at" TIMESTAMPTZ,
        "ip_address" INET,
        "user_agent" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refresh_tokens_jti" UNIQUE ("jti"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_jti" ON "refresh_tokens" ("jti")
    `);

    // ==================== PROBLEMS TABLES ====================

    // Create topics table
    await queryRunner.query(`
      CREATE TABLE "topics" (
        "id" SERIAL NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "slug" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "icon" VARCHAR(50),
        "problem_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_topics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_topics_name" UNIQUE ("name"),
        CONSTRAINT "UQ_topics_slug" UNIQUE ("slug")
      )
    `);

    // Create tags table
    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" SERIAL NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "slug" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "problem_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tags_name" UNIQUE ("name"),
        CONSTRAINT "UQ_tags_slug" UNIQUE ("slug")
      )
    `);

    // Create programming_languages table
    await queryRunner.query(`
      CREATE TABLE "programming_languages" (
        "id" SERIAL NOT NULL,
        "name" VARCHAR(50) NOT NULL,
        "slug" VARCHAR(50) NOT NULL,
        "judge0_id" INTEGER,
        "monaco_id" VARCHAR(50),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_programming_languages" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_programming_languages_name" UNIQUE ("name"),
        CONSTRAINT "UQ_programming_languages_slug" UNIQUE ("slug")
      )
    `);

    // Create problems table
    await queryRunner.query(`
      CREATE TABLE "problems" (
        "id" SERIAL NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(255) NOT NULL,
        "description" TEXT NOT NULL,
        "constraints" TEXT,
        "difficulty" problem_difficulty_enum NOT NULL,
        "is_premium" BOOLEAN NOT NULL DEFAULT false,
        "is_published" BOOLEAN NOT NULL DEFAULT false,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "total_submissions" INTEGER NOT NULL DEFAULT 0,
        "total_accepted" INTEGER NOT NULL DEFAULT 0,
        "acceptance_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
        "total_attempts" INTEGER NOT NULL DEFAULT 0,
        "total_solved" INTEGER NOT NULL DEFAULT 0,
        "average_time_to_solve" INTEGER,
        "difficulty_rating" DECIMAL(4,2),
        "testcase_file_key" TEXT,
        "testcase_count" INTEGER NOT NULL DEFAULT 0,
        "time_limit_ms" INTEGER NOT NULL DEFAULT 2000,
        "memory_limit_kb" INTEGER NOT NULL DEFAULT 256000,
        "hints" JSONB NOT NULL DEFAULT '[]',
        "has_official_solution" BOOLEAN NOT NULL DEFAULT false,
        "official_solution_content" TEXT,
        "similar_problems" INTEGER[] DEFAULT '{}',
        "created_by" INTEGER,
        "updated_by" INTEGER,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_problems" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_problems_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_problems_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_problems_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_problems_slug" ON "problems" ("slug")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_problems_difficulty" ON "problems" ("difficulty")
    `);

    // Create sample_testcases table
    await queryRunner.query(`
      CREATE TABLE "sample_testcases" (
        "id" SERIAL NOT NULL,
        "problem_id" INTEGER NOT NULL,
        "input" TEXT NOT NULL,
        "expected_output" TEXT NOT NULL,
        "order_index" INTEGER NOT NULL DEFAULT 0,
        "explanation" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sample_testcases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sample_testcases_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sample_testcases_problem" ON "sample_testcases" ("problem_id")
    `);

    // Create problem_topics junction table
    await queryRunner.query(`
      CREATE TABLE "problem_topics" (
        "problem_id" INTEGER NOT NULL,
        "topic_id" INTEGER NOT NULL,
        CONSTRAINT "PK_problem_topics" PRIMARY KEY ("problem_id", "topic_id"),
        CONSTRAINT "FK_problem_topics_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_problem_topics_topic" FOREIGN KEY ("topic_id")
          REFERENCES "topics"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_problem_topics_problem" ON "problem_topics" ("problem_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_problem_topics_topic" ON "problem_topics" ("topic_id")
    `);

    // Create problem_tags junction table
    await queryRunner.query(`
      CREATE TABLE "problem_tags" (
        "problem_id" INTEGER NOT NULL,
        "tag_id" INTEGER NOT NULL,
        CONSTRAINT "PK_problem_tags" PRIMARY KEY ("problem_id", "tag_id"),
        CONSTRAINT "FK_problem_tags_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_problem_tags_tag" FOREIGN KEY ("tag_id")
          REFERENCES "tags"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_problem_tags_problem" ON "problem_tags" ("problem_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_problem_tags_tag" ON "problem_tags" ("tag_id")
    `);

    // ==================== SUBMISSIONS TABLES ====================

    // Create submissions table
    await queryRunner.query(`
      CREATE TABLE "submissions" (
        "id" SERIAL NOT NULL,
        "user_id" INTEGER NOT NULL,
        "problem_id" INTEGER NOT NULL,
        "language_id" INTEGER NOT NULL,
        "code" TEXT NOT NULL,
        "code_length" INTEGER,
        "status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
        "passed_testcases" INTEGER NOT NULL DEFAULT 0,
        "total_testcases" INTEGER NOT NULL DEFAULT 0,
        "runtime_ms" INTEGER,
        "memory_kb" INTEGER,
        "testcase_results" JSONB NOT NULL DEFAULT '[]',
        "judge0_token" VARCHAR(255),
        "error_message" TEXT,
        "error_line" INTEGER,
        "compile_output" TEXT,
        "ip_address" INET,
        "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
        "judged_at" TIMESTAMPTZ,
        "penalty_time" INTEGER NOT NULL DEFAULT 0,
        "is_after_contest" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "PK_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_submissions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_submissions_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_submissions_language" FOREIGN KEY ("language_id")
          REFERENCES "programming_languages"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_submissions_user" ON "submissions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_submissions_problem" ON "submissions" ("problem_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_submissions_status" ON "submissions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_submissions_submitted_at" ON "submissions" ("submitted_at")
    `);

    // Create user_problem_progress table
    await queryRunner.query(`
      CREATE TABLE "user_problem_progress" (
        "user_id" INTEGER NOT NULL,
        "problem_id" INTEGER NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'Attempted',
        "total_attempts" INTEGER NOT NULL DEFAULT 0,
        "total_accepted" INTEGER NOT NULL DEFAULT 0,
        "best_submission_id" INTEGER,
        "best_runtime_ms" INTEGER,
        "best_memory_kb" INTEGER,
        "first_attempted_at" TIMESTAMP NOT NULL DEFAULT now(),
        "first_solved_at" TIMESTAMPTZ,
        "last_attempted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_user_problem_progress" PRIMARY KEY ("user_id", "problem_id"),
        CONSTRAINT "FK_user_problem_progress_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_problem_progress_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_problem_progress_best_submission" FOREIGN KEY ("best_submission_id")
          REFERENCES "submissions"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_problem_progress_user" ON "user_problem_progress" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_problem_progress_problem" ON "user_problem_progress" ("problem_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_problem_progress_status" ON "user_problem_progress" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_problem_progress" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "submissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "problem_tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "problem_topics" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sample_testcases" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "problems" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "programming_languages" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "topics" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE IF EXISTS "progress_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "submission_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "problem_difficulty_enum"`);
  }
}

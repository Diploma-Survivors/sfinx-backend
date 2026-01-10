import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentsModule1735400000000 implements MigrationInterface {
  name = 'AddCommentsModule1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create comment_type_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "comment_type_enum" AS ENUM ('Feedback', 'Question', 'Tip');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create report_reason_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_reason_enum" AS ENUM ('Spam', 'Inappropriate', 'Harassment', 'Off Topic', 'Misinformation', 'Other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create vote_type_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "vote_type_enum" AS ENUM ('1', '-1');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create comments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comments" (
        "id" SERIAL NOT NULL,
        "problem_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "parent_id" INTEGER,
        "content" TEXT NOT NULL,
        "type" "comment_type_enum" NOT NULL DEFAULT 'Feedback',
        "is_pinned" BOOLEAN NOT NULL DEFAULT false,
        "is_edited" BOOLEAN NOT NULL DEFAULT false,
        "is_deleted" BOOLEAN NOT NULL DEFAULT false,
        "upvote_count" INTEGER NOT NULL DEFAULT 0,
        "downvote_count" INTEGER NOT NULL DEFAULT 0,
        "vote_score" INTEGER NOT NULL DEFAULT 0,
        "reply_count" INTEGER NOT NULL DEFAULT 0,
        "report_count" INTEGER NOT NULL DEFAULT 0,
        "edited_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parent_id")
          REFERENCES "comments"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for comments table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_problem" ON "comments" ("problem_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_user" ON "comments" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_parent" ON "comments" ("parent_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_vote_score" ON "comments" ("vote_score" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_pinned" ON "comments" ("is_pinned", "vote_score" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_created" ON "comments" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_problem_parent" ON "comments" ("problem_id", "parent_id")
    `);

    // Create comment_votes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comment_votes" (
        "comment_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "vote_type" "vote_type_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comment_votes" PRIMARY KEY ("comment_id", "user_id"),
        CONSTRAINT "FK_comment_votes_comment" FOREIGN KEY ("comment_id")
          REFERENCES "comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comment_votes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for comment_votes table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comment_votes_comment" ON "comment_votes" ("comment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comment_votes_user" ON "comment_votes" ("user_id")
    `);

    // Create comment_reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comment_reports" (
        "id" SERIAL NOT NULL,
        "comment_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "reason" "report_reason_enum" NOT NULL,
        "description" TEXT,
        "is_resolved" BOOLEAN NOT NULL DEFAULT false,
        "resolved_at" TIMESTAMPTZ,
        "resolved_by" INTEGER,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comment_reports" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_comment_reports_user" UNIQUE ("comment_id", "user_id"),
        CONSTRAINT "FK_comment_reports_comment" FOREIGN KEY ("comment_id")
          REFERENCES "comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comment_reports_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comment_reports_resolver" FOREIGN KEY ("resolved_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for comment_reports table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comment_reports_comment" ON "comment_reports" ("comment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comment_reports_user" ON "comment_reports" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comment_reports_resolved" ON "comment_reports" ("is_resolved", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop comment_reports table
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_comment_reports_resolved"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comment_reports_user"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_comment_reports_comment"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "comment_reports" CASCADE`);

    // Drop comment_votes table
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comment_votes_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comment_votes_comment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comment_votes" CASCADE`);

    // Drop comments table
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_comments_problem_parent"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_pinned"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_vote_score"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_problem"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comments" CASCADE`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "vote_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_reason_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "comment_type_enum"`);
  }
}

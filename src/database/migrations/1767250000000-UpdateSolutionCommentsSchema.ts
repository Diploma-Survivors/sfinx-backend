import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSolutionCommentsSchema1767250000000 implements MigrationInterface {
  name = 'UpdateSolutionCommentsSchema1767250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to solution_comments table to match base comment structure
    await queryRunner.query(`
      ALTER TABLE "solution_comments"
      ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "vote_score" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMPTZ
    `);

    // Create indexes for new columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solution_comments_pinned"
      ON "solution_comments" ("is_pinned", "vote_score" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solution_comments_vote_score"
      ON "solution_comments" ("vote_score" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solution_comments_created_at"
      ON "solution_comments" ("created_at" DESC)
    `);

    // Update FK constraint for parent_id to use SET NULL instead of CASCADE
    await queryRunner.query(`
      ALTER TABLE "solution_comments"
      DROP CONSTRAINT IF EXISTS "FK_solution_comments_parent"
    `);

    await queryRunner.query(`
      ALTER TABLE "solution_comments"
      ADD CONSTRAINT "FK_solution_comments_parent"
      FOREIGN KEY ("parent_id")
      REFERENCES "solution_comments"("id")
      ON DELETE SET NULL
    `);

    // Calculate initial vote_score from existing upvote/downvote counts
    await queryRunner.query(`
      UPDATE "solution_comments"
      SET "vote_score" = "upvote_count" - "downvote_count"
      WHERE "vote_score" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_solution_comments_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_solution_comments_vote_score"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_solution_comments_pinned"`,
    );

    // Restore original FK constraint
    await queryRunner.query(`
      ALTER TABLE "solution_comments"
      DROP CONSTRAINT IF EXISTS "FK_solution_comments_parent"
    `);

    await queryRunner.query(`
      ALTER TABLE "solution_comments"
      ADD CONSTRAINT "FK_solution_comments_parent"
      FOREIGN KEY ("parent_id")
      REFERENCES "solution_comments"("id")
      ON DELETE CASCADE
    `);

    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE "solution_comments"
      DROP COLUMN IF EXISTS "edited_at",
      DROP COLUMN IF EXISTS "vote_score",
      DROP COLUMN IF EXISTS "is_deleted",
      DROP COLUMN IF EXISTS "is_edited",
      DROP COLUMN IF EXISTS "is_pinned"
    `);
  }
}

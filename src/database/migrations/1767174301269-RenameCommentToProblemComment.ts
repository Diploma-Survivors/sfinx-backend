import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCommentToProblemComment1767174301269 implements MigrationInterface {
  name = 'RenameCommentToProblemComment1767174301269';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints on tables to be renamed
    await queryRunner.query(
      `ALTER TABLE "comment_reports" DROP CONSTRAINT IF EXISTS "FK_45a6086948851a5e791f1b7964f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "FK_comments_problem"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "FK_comments_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "FK_comments_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_votes" DROP CONSTRAINT IF EXISTS "FK_comment_votes_comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_votes" DROP CONSTRAINT IF EXISTS "FK_comment_votes_user"`,
    );

    // Drop old indices
    const oldIndices = [
      'IDX_comments_problem',
      'IDX_comments_user',
      'IDX_comments_parent',
      'IDX_comments_vote_score',
      'IDX_comments_pinned',
      'IDX_comments_created',
      'IDX_comments_problem_parent',
      'IDX_comment_votes_comment',
      'IDX_comment_votes_user',
      'IDX_comment_reports_comment',
    ];
    for (const idx of oldIndices) {
      await queryRunner.query(`DROP INDEX IF EXISTS "public"."${idx}"`);
    }

    // Create new Enums
    await queryRunner.query(
      `CREATE TYPE "public"."problem_comments_type_enum" AS ENUM('Feedback', 'Question', 'Tip')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."problem_comment_votes_vote_type_enum" AS ENUM('1', '-1')`,
    );

    // RENAME TABLES AND COLUMNS
    await queryRunner.query(
      `ALTER TABLE "comments" RENAME TO "problem_comments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_votes" RENAME TO "problem_comment_votes"`,
    );

    // Fix potential camelCase column from drift
    await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'problem_comment_votes' 
                    AND column_name = 'voteType'
                ) THEN 
                    ALTER TABLE "problem_comment_votes" RENAME COLUMN "voteType" TO "vote_type"; 
                END IF; 
            END $$;
        `);

    // await queryRunner.query(`ALTER TABLE "problem_comments" RENAME COLUMN "user_id" TO "author_id"`); // Already done in 1735600000002

    // UPDATE TYPES
    await queryRunner.query(
      `ALTER TABLE "problem_comments" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" ALTER COLUMN "type" TYPE "public"."problem_comments_type_enum" USING "type"::"text"::"public"."problem_comments_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" ALTER COLUMN "type" SET DEFAULT 'Feedback'`,
    );

    await queryRunner.query(
      `ALTER TABLE "problem_comment_votes" ALTER COLUMN "vote_type" TYPE "public"."problem_comment_votes_vote_type_enum" USING "vote_type"::"text"::"public"."problem_comment_votes_vote_type_enum"`,
    );

    // Recreate indices for renamed tables
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comments_problem" ON "problem_comments" ("problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comments_author" ON "problem_comments" ("author_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comments_parent" ON "problem_comments" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comments_vote_score" ON "problem_comments" ("vote_score" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comments_pinned" ON "problem_comments" ("is_pinned", "vote_score" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comments_created" ON "problem_comments" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comment_votes_comment" ON "problem_comment_votes" ("comment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_problem_comment_votes_user" ON "problem_comment_votes" ("user_id")`,
    );

    // Recreate Constraints
    await queryRunner.query(
      `ALTER TABLE "problem_comments" ADD CONSTRAINT "FK_727e1be843d3f997d74fd79ab69" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" ADD CONSTRAINT "FK_d15489b1b3048d67268c1e81b01" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" ADD CONSTRAINT "FK_2c6fb2e60b906efb0088554f320" FOREIGN KEY ("parent_id") REFERENCES "problem_comments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comment_votes" ADD CONSTRAINT "FK_17c2e386ce61098b9c0df19de96" FOREIGN KEY ("comment_id") REFERENCES "problem_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comment_votes" ADD CONSTRAINT "FK_b7e620bdfaf95cce791b4e2b0d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_reports" ADD CONSTRAINT "FK_45a6086948851a5e791f1b7964f" FOREIGN KEY ("comment_id") REFERENCES "problem_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Drop old enums
    await queryRunner.query(`DROP TYPE IF EXISTS "comment_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints
    await queryRunner.query(
      `ALTER TABLE "comment_reports" DROP CONSTRAINT IF EXISTS "FK_45a6086948851a5e791f1b7964f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" DROP CONSTRAINT IF EXISTS "FK_727e1be843d3f997d74fd79ab69"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" DROP CONSTRAINT IF EXISTS "FK_d15489b1b3048d67268c1e81b01"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comments" DROP CONSTRAINT IF EXISTS "FK_2c6fb2e60b906efb0088554f320"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comment_votes" DROP CONSTRAINT IF EXISTS "FK_17c2e386ce61098b9c0df19de96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comment_votes" DROP CONSTRAINT IF EXISTS "FK_b7e620bdfaf95cce791b4e2b0d4"`,
    );

    // Drop new indices
    const newIndices = [
      'IDX_problem_comments_problem',
      'IDX_problem_comments_author',
      'IDX_problem_comments_parent',
      'IDX_problem_comments_vote_score',
      'IDX_problem_comments_pinned',
      'IDX_problem_comments_created',
      'IDX_problem_comment_votes_comment',
      'IDX_problem_comment_votes_user',
    ];
    for (const idx of newIndices) {
      await queryRunner.query(`DROP INDEX IF EXISTS "public"."${idx}"`);
    }

    // Recreate old Enums
    await queryRunner.query(
      `CREATE TYPE "comment_type_enum" AS ENUM('Feedback', 'Question', 'Tip')`,
    );

    // REVERSE RENAME: Author ID -> User ID
    await queryRunner.query(
      `ALTER TABLE "problem_comments" RENAME COLUMN "author_id" TO "user_id"`,
    );

    // REVERSE REVERSE TABLE NAMING
    await queryRunner.query(
      `ALTER TABLE "problem_comments" RENAME TO "comments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "problem_comment_votes" RENAME TO "comment_votes"`,
    );

    // Revert Types
    await queryRunner.query(
      `ALTER TABLE "comments" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ALTER COLUMN "type" TYPE "comment_type_enum" USING "type"::"text"::"comment_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ALTER COLUMN "type" SET DEFAULT 'Feedback'`,
    );

    // Recreate old indices
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_problem" ON "comments" ("problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_user" ON "comments" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_parent" ON "comments" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_vote_score" ON "comments" ("vote_score" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_pinned" ON "comments" ("is_pinned", "vote_score" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_created" ON "comments" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_problem_parent" ON "comments" ("problem_id", "parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_votes_comment" ON "comment_votes" ("comment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_votes_user" ON "comment_votes" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_reports_comment" ON "comment_reports" ("comment_id")`,
    );

    // Recreate old constraints
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_problem" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_votes" ADD CONSTRAINT "FK_comment_votes_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_votes" ADD CONSTRAINT "FK_comment_votes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_reports" ADD CONSTRAINT "FK_45a6086948851a5e791f1b7964f" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE`,
    );

    // Drop new Enums
    await queryRunner.query(`DROP TYPE IF EXISTS "problem_comments_type_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "problem_comment_votes_vote_type_enum"`,
    );
  }
}

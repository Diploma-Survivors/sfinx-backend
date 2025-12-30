import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContestModule1735000000000 implements MigrationInterface {
  name = 'AddContestModule1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create contest_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contest_status_enum" AS ENUM ('Draft', 'Scheduled', 'Running', 'Ended', 'Cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create contests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contests" (
        "id" SERIAL NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "rules" TEXT,
        "start_time" TIMESTAMPTZ NOT NULL,
        "end_time" TIMESTAMPTZ NOT NULL,
        "status" "contest_status_enum" NOT NULL DEFAULT 'Draft',
        "participant_count" INTEGER NOT NULL DEFAULT 0,
        "max_participants" INTEGER NOT NULL DEFAULT 0,
        "duration_minutes" INTEGER NOT NULL,
        "created_by" INTEGER,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contests_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_contests_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for contests
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contests_status" ON "contests" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contests_start_time" ON "contests" ("start_time")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contests_slug" ON "contests" ("slug")
    `);

    // Create contest_problems junction table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contest_problems" (
        "contest_id" INTEGER NOT NULL,
        "problem_id" INTEGER NOT NULL,
        "points" INTEGER NOT NULL DEFAULT 100,
        "order_index" INTEGER NOT NULL DEFAULT 0,
        "label" VARCHAR(10),
        CONSTRAINT "PK_contest_problems" PRIMARY KEY ("contest_id", "problem_id"),
        CONSTRAINT "FK_contest_problems_contest" FOREIGN KEY ("contest_id")
          REFERENCES "contests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contest_problems_problem" FOREIGN KEY ("problem_id")
          REFERENCES "problems"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contest_problems_contest" ON "contest_problems" ("contest_id")
    `);

    // Create contest_participants table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contest_participants" (
        "contest_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "total_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "rank" INTEGER,
        "problem_scores" JSONB NOT NULL DEFAULT '{}',
        "total_submissions" INTEGER NOT NULL DEFAULT 0,
        "last_submission_at" TIMESTAMPTZ,
        "registered_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contest_participants" PRIMARY KEY ("contest_id", "user_id"),
        CONSTRAINT "FK_contest_participants_contest" FOREIGN KEY ("contest_id")
          REFERENCES "contests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contest_participants_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contest_participants_contest" ON "contest_participants" ("contest_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contest_participants_user" ON "contest_participants" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contest_participants_rank" ON "contest_participants" ("contest_id", "rank")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contest_participants_score" ON "contest_participants" ("contest_id", "total_score" DESC)
    `);

    // Add contest_id to submissions table
    const hasContestId = await queryRunner.hasColumn(
      'submissions',
      'contest_id',
    );
    if (!hasContestId) {
      await queryRunner.query(`
          ALTER TABLE "submissions" ADD COLUMN "contest_id" INTEGER
        `);
      await queryRunner.query(`
          ALTER TABLE "submissions" ADD CONSTRAINT "FK_submissions_contest"
            FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE SET NULL
        `);
      await queryRunner.query(`
          CREATE INDEX "IDX_submissions_contest" ON "submissions" ("contest_id")
        `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove contest_id from submissions
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_contest"`);
    await queryRunner.query(`
      ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "FK_submissions_contest"
    `);
    await queryRunner.query(`
      ALTER TABLE "submissions" DROP COLUMN IF EXISTS "contest_id"
    `);

    // Drop contest tables
    await queryRunner.query(
      `DROP TABLE IF EXISTS "contest_participants" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "contest_problems" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contests" CASCADE`);

    // Drop enum
    await queryRunner.query(`DROP TYPE IF EXISTS "contest_status_enum"`);
  }
}

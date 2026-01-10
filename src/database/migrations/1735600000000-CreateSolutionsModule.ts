import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSolutionsModule1735600000000 implements MigrationInterface {
  name = 'CreateSolutionsModule1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Vote Type Enum if not exists (might be created by Comments module)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "vote_type_enum" AS ENUM ('1', '-1');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Create Solutions Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solutions" (
        "id" SERIAL NOT NULL,
        "problem_id" INTEGER NOT NULL,
        "author_id" INTEGER NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "content" TEXT NOT NULL,
        "upvote_count" INTEGER NOT NULL DEFAULT 0,
        "downvote_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_solutions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_solutions_problem" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solutions_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Indexes for Solutions
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solutions_problem" ON "solutions" ("problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solutions_author" ON "solutions" ("author_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solutions_created_at" ON "solutions" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solutions_upvotes" ON "solutions" ("upvote_count" DESC)`,
    );

    // 3. Create Solution Comments Table (Self-referencing)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solution_comments" (
        "id" SERIAL NOT NULL,
        "solution_id" INTEGER NOT NULL,
        "author_id" INTEGER NOT NULL,
        "parent_id" INTEGER,
        "content" TEXT NOT NULL,
        "upvote_count" INTEGER NOT NULL DEFAULT 0,
        "downvote_count" INTEGER NOT NULL DEFAULT 0,
        "reply_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_solution_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_solution_comments_solution" FOREIGN KEY ("solution_id") REFERENCES "solutions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solution_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solution_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "solution_comments"("id") ON DELETE CASCADE
      )
    `);

    // Indexes for Solution Comments
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solution_comments_solution" ON "solution_comments" ("solution_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solution_comments_parent" ON "solution_comments" ("parent_id")`,
    );

    // 4. Create Solution Votes Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solution_votes" (
        "solution_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "vote_type" "vote_type_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_solution_votes" PRIMARY KEY ("solution_id", "user_id"),
        CONSTRAINT "FK_solution_votes_solution" FOREIGN KEY ("solution_id") REFERENCES "solutions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solution_votes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 5. Create Solution Comment Votes Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solution_comment_votes" (
        "comment_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "vote_type" "vote_type_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_solution_comment_votes" PRIMARY KEY ("comment_id", "user_id"),
        CONSTRAINT "FK_solution_comment_votes_comment" FOREIGN KEY ("comment_id") REFERENCES "solution_comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solution_comment_votes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 6. Create Junction Tables for Tags and Languages
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solution_tags" (
        "solution_id" INTEGER NOT NULL,
        "tag_id" INTEGER NOT NULL,
        CONSTRAINT "PK_solution_tags" PRIMARY KEY ("solution_id", "tag_id"),
        CONSTRAINT "FK_solution_tags_solution" FOREIGN KEY ("solution_id") REFERENCES "solutions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solution_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solution_languages" (
        "solution_id" INTEGER NOT NULL,
        "language_id" INTEGER NOT NULL,
        CONSTRAINT "PK_solution_languages" PRIMARY KEY ("solution_id", "language_id"),
        CONSTRAINT "FK_solution_languages_solution" FOREIGN KEY ("solution_id") REFERENCES "solutions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_solution_languages_language" FOREIGN KEY ("language_id") REFERENCES "programming_languages"("id") ON DELETE CASCADE
      )
    `);

    // 7. Seed Permissions
    const permissions = [
      {
        resource: 'solution',
        action: 'create',
        description: 'Create solutions',
      },
      { resource: 'solution', action: 'read', description: 'View solutions' },
      {
        resource: 'solution',
        action: 'update',
        description: 'Update solutions',
      },
      {
        resource: 'solution',
        action: 'delete',
        description: 'Delete solutions',
      },
      {
        resource: 'solution',
        action: 'vote',
        description: 'Vote on solutions',
      },
      {
        resource: 'solution_comment',
        action: 'create',
        description: 'Create solution comments',
      },
      {
        resource: 'solution_comment',
        action: 'read',
        description: 'View solution comments',
      },
      {
        resource: 'solution_comment',
        action: 'update',
        description: 'Update solution comments',
      },
      {
        resource: 'solution_comment',
        action: 'delete',
        description: 'Delete solution comments',
      },
      {
        resource: 'solution_comment',
        action: 'vote',
        description: 'Vote on solution comments',
      },
    ];

    // Get Admin role ID
    const adminRole = (await queryRunner.query(
      `SELECT id FROM roles WHERE slug = 'admin'`,
    )) as Array<{ id: number }>;
    const adminRoleId = adminRole[0]?.id;

    if (!adminRoleId) {
      console.warn('Admin role not found, skipping permission assignment');
    }

    for (const perm of permissions) {
      // Insert Permission
      await queryRunner.query(`
        INSERT INTO "permissions" ("resource", "action", "description", "created_at", "updated_at")
        SELECT '${perm.resource}', '${perm.action}', '${perm.description}', now(), now()
        WHERE NOT EXISTS (
            SELECT 1 FROM "permissions" WHERE "resource" = '${perm.resource}' AND "action" = '${perm.action}'
        );
      `);

      // Assign to Admin Role
      if (adminRoleId) {
        const permRecord = (await queryRunner.query(
          `SELECT id FROM permissions WHERE resource = '${perm.resource}' AND action = '${perm.action}'`,
        )) as Array<{ id: number }>;
        const permId = permRecord[0]?.id;

        if (permId) {
          await queryRunner.query(`
            INSERT INTO "role_permissions" ("role_id", "permission_id")
            SELECT ${adminRoleId}, ${permId}
            WHERE NOT EXISTS (
                SELECT 1 FROM "role_permissions" WHERE "role_id" = ${adminRoleId} AND "permission_id" = ${permId}
            );
          `);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop Tables from child to parent
    await queryRunner.query(`DROP TABLE IF EXISTS "solution_languages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "solution_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "solution_comment_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "solution_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "solution_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "solutions"`);

    // Remove Permissions
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "resource" IN ('solution', 'solution_comment')`,
    );
  }
}

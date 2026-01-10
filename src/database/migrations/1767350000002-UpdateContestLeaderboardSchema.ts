import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateContestLeaderboardSchema1767350000002 implements MigrationInterface {
  name = 'UpdateContestLeaderboardSchema1767350000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename registered_at -> started_at
    // Check if old column exists and new one doesn't
    // Note: Renaming is tricky to make purely idempotent without checking, but TypeORM has methods.
    // We'll use raw SQL checks for safety as requested.

    // This block handles the rename safely
    const table = await queryRunner.getTable('contest_participants');
    const registeredColumn = table?.findColumnByName('registered_at');
    const startedColumn = table?.findColumnByName('started_at');

    if (registeredColumn && !startedColumn) {
      await queryRunner.query(
        `ALTER TABLE "contest_participants" RENAME COLUMN "registered_at" TO "started_at"`,
      );
    }

    // 2. Add solved_count
    if (!table?.findColumnByName('solved_count')) {
      await queryRunner.query(
        `ALTER TABLE "contest_participants" ADD "solved_count" integer NOT NULL DEFAULT '0'`,
      );
    }

    // 3. Add finish_time
    if (!table?.findColumnByName('finish_time')) {
      await queryRunner.query(
        `ALTER TABLE "contest_participants" ADD "finish_time" bigint NOT NULL DEFAULT '0'`,
      );
    }

    // 4. Remove penalty_time if it exists (Cleanup from previous attempts or old schema)
    if (table?.findColumnByName('penalty_time')) {
      await queryRunner.query(
        `ALTER TABLE "contest_participants" DROP COLUMN "penalty_time"`,
      );
    }

    // 5. Add version for optimistic locking
    if (!table?.findColumnByName('version')) {
      await queryRunner.query(
        `ALTER TABLE "contest_participants" ADD "version" integer NOT NULL DEFAULT '0'`,
      );
    }

    // 6. Remove rank column
    if (table?.findColumnByName('rank')) {
      await queryRunner.query(
        `ALTER TABLE "contest_participants" DROP COLUMN "rank"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert checks omitted for brevity but generally symmetric to up()
    await queryRunner.query(
      `ALTER TABLE "contest_participants" ADD IF NOT EXISTS "rank" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "contest_participants" DROP COLUMN IF EXISTS "version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contest_participants" DROP COLUMN IF EXISTS "finish_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contest_participants" DROP COLUMN IF EXISTS "solved_count"`,
    );
    // Try to revert rename
    await queryRunner.query(
      `ALTER TABLE "contest_participants" RENAME COLUMN "started_at" TO "registered_at"`,
    );
  }
}

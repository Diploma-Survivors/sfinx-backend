import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveLastSolveAt1768109335200 implements MigrationInterface {
  name = 'MoveLastSolveAt1768109335200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add column to user_statistics
    await queryRunner.query(
      `ALTER TABLE "user_statistics" ADD "last_solve_at" TIMESTAMP WITH TIME ZONE`,
    );

    // 2. Copy data from users
    await queryRunner.query(`
            UPDATE "user_statistics"
            SET "last_solve_at" = "users"."last_solve_at"
            FROM "users"
            WHERE "user_statistics"."user_id" = "users"."id"
            AND "users"."last_solve_at" IS NOT NULL
        `);

    // 3. Drop column from users
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_solve_at"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Add column back to users
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_solve_at" TIMESTAMP WITH TIME ZONE`,
    );

    // 2. Copy data back to users
    await queryRunner.query(`
            UPDATE "users"
            SET "last_solve_at" = "user_statistics"."last_solve_at"
            FROM "user_statistics"
            WHERE "users"."id" = "user_statistics"."user_id"
            AND "user_statistics"."last_solve_at" IS NOT NULL
        `);

    // 3. Drop column from user_statistics
    await queryRunner.query(
      `ALTER TABLE "user_statistics" DROP COLUMN "last_solve_at"`,
    );
  }
}

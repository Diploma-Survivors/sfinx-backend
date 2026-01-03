import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalStatsToUser1767350000001 implements MigrationInterface {
  name = 'AddGlobalStatsToUser1767350000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists before adding to avoid error on re-run
    const hasColumn = await queryRunner.hasColumn('users', 'global_score');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "global_score" numeric(10,2) NOT NULL DEFAULT '0'`,
      );
    }

    // Add solved stats columns
    const hasSolvedEasy = await queryRunner.hasColumn('users', 'solved_easy');
    if (!hasSolvedEasy) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "solved_easy" integer NOT NULL DEFAULT '0'`,
      );
    }

    const hasSolvedMedium = await queryRunner.hasColumn(
      'users',
      'solved_medium',
    );
    if (!hasSolvedMedium) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "solved_medium" integer NOT NULL DEFAULT '0'`,
      );
    }

    const hasSolvedHard = await queryRunner.hasColumn('users', 'solved_hard');
    if (!hasSolvedHard) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "solved_hard" integer NOT NULL DEFAULT '0'`,
      );
    }

    const hasLastSolveAt = await queryRunner.hasColumn(
      'users',
      'last_solve_at',
    );
    if (!hasLastSolveAt) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "last_solve_at" timestamp with time zone`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('users', 'global_score');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "global_score"`);
    }
  }
}

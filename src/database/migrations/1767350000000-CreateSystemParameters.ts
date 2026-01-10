import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemParameters1767350000000 implements MigrationInterface {
  name = 'CreateSystemParameters1767350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create System Parameters Table (Configuration) - Check existence implicitly via "IF NOT EXISTS" in SQL if supported,
    // but TypeORM usually handles sync. For manual migration, use safe SQL.
    // Postgres supports IF NOT EXISTS for CREATE TABLE.
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "system_parameters" ("key" character varying NOT NULL, "value" text NOT NULL, "description" character varying, CONSTRAINT "PK_system_parameters" PRIMARY KEY ("key"))`,
    );

    // Seed Data (Safe Insert)
    await queryRunner.query(
      `INSERT INTO "system_parameters" ("key", "value", "description") VALUES
            ('PROBLEM_WEIGHT_EASY', '10', 'Score weight for Easy problems'),
            ('PROBLEM_WEIGHT_MEDIUM', '20', 'Score weight for Medium problems'),
            ('PROBLEM_WEIGHT_HARD', '30', 'Score weight for Hard problems'),
            ('LEADERBOARD_UPDATE_RETRIES', '3', 'Max retries for optimistic locking on leaderboard updates')
            ON CONFLICT ("key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_parameters"`);
  }
}

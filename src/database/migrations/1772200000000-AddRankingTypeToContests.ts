import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRankingTypeToContests1772200000000 implements MigrationInterface {
  name = 'AddRankingTypeToContests1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contests_ranking_type_enum') THEN
          CREATE TYPE "contests_ranking_type_enum" AS ENUM ('0');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "contests"
      ADD COLUMN IF NOT EXISTS "ranking_type" "contests_ranking_type_enum" NOT NULL DEFAULT '0'
    `);

    await queryRunner.query(`
      UPDATE "contests" SET "ranking_type" = '0' WHERE "ranking_type" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contests" DROP COLUMN IF EXISTS "ranking_type"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "contests_ranking_type_enum"
    `);
  }
}

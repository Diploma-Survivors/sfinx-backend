import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHarnessCodeToLanguages1773425731332 implements MigrationInterface {
  name = 'AddHarnessCodeToLanguages1773425731332';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      ADD COLUMN IF NOT EXISTS "harness_code" TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      DROP COLUMN IF EXISTS "harness_code"
    `);
  }
}

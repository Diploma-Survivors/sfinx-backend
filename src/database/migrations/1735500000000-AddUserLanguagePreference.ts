import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLanguagePreference1735500000000 implements MigrationInterface {
  name = 'AddUserLanguagePreference1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPreferredLanguage = await queryRunner.hasColumn(
      'users',
      'preferred_language',
    );
    if (!hasPreferredLanguage) {
      await queryRunner.query(`
          ALTER TABLE "users"
          ADD COLUMN "preferred_language" VARCHAR(2) NOT NULL DEFAULT 'en'
        `);

      await queryRunner.query(`
          COMMENT ON COLUMN "users"."preferred_language" IS 'User preferred language for i18n (en, vi)'
        `);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_preferred_language') THEN
              ALTER TABLE "users"
              ADD CONSTRAINT "CHK_preferred_language" CHECK (preferred_language IN ('en', 'vi'));
          END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "CHK_preferred_language"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "preferred_language"`,
    );
  }
}

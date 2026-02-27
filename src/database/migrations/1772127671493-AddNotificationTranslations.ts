import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationTranslations1772127671493 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create translation table
    await queryRunner.query(`
      CREATE TABLE "notification_translations" (
        "id" SERIAL PRIMARY KEY,
        "notification_id" uuid NOT NULL,
        "language_code" varchar(10) NOT NULL,
        "title" varchar(255) NOT NULL,
        "content" text NOT NULL,
        CONSTRAINT "fk_notif_translation_notif"
          FOREIGN KEY ("notification_id")
          REFERENCES "notifications"("id")
          ON DELETE CASCADE
      )
    `);

    // 2. Backfill existing rows as 'en' translations
    await queryRunner.query(`
      INSERT INTO "notification_translations" ("notification_id", "language_code", "title", "content")
      SELECT "id", 'en', "title", "content" FROM "notifications"
    `);

    // 3. Drop original columns from notifications
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "content"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add columns with temporary defaults for population
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "title" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "content" text NOT NULL DEFAULT ''`,
    );

    // Restore values from EN translations
    await queryRunner.query(`
      UPDATE "notifications" n
      SET "title" = t."title", "content" = t."content"
      FROM "notification_translations" t
      WHERE t."notification_id" = n."id" AND t."language_code" = 'en'
    `);

    // Remove temporary defaults
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "title" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "content" DROP DEFAULT`,
    );

    await queryRunner.query(`DROP TABLE "notification_translations"`);
  }
}

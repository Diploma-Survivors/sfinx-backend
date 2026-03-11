import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudyPlanNotificationType1773237186708 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'STUDY_PLAN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
    // Recreate the type without STUDY_PLAN if needed.
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ALTER COLUMN "type" TYPE text USING "type"::text
    `);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
    await queryRunner.query(
      `CREATE TYPE "notification_type_enum" AS ENUM ('SYSTEM', 'COMMENT', 'REPLY', 'CONTEST', 'MENTION')`,
    );
    await queryRunner.query(`
      DELETE FROM "notifications" WHERE "type" = 'STUDY_PLAN'
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ALTER COLUMN "type" TYPE "notification_type_enum"
      USING "type"::"notification_type_enum"
    `);
  }
}

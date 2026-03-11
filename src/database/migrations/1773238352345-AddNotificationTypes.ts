import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationTypes1773238352345 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'PAYMENT'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'SUBMISSION'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'DISCUSS'`,
    );

    // Drop the link column — FE builds links from type + metadata
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN IF EXISTS "link"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the link column
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "link" varchar(255)`,
    );

    // PostgreSQL does not support removing enum values directly.
    // Recreate the type without PAYMENT, SUBMISSION, DISCUSS if needed.
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ALTER COLUMN "type" TYPE text USING "type"::text
    `);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
    await queryRunner.query(
      `CREATE TYPE "notification_type_enum" AS ENUM ('SYSTEM', 'COMMENT', 'REPLY', 'CONTEST', 'MENTION', 'STUDY_PLAN')`,
    );
    await queryRunner.query(`
      UPDATE "notifications" SET "type" = 'SYSTEM'
      WHERE "type" IN ('PAYMENT', 'SUBMISSION', 'DISCUSS')
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ALTER COLUMN "type" TYPE "notification_type_enum"
      USING "type"::"notification_type_enum"
    `);
  }
}

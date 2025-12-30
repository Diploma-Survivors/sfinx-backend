import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddPhoneColumnForUsers1735500000002 implements MigrationInterface {
  name = 'AddPhoneColumnForUsers1735500000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPhone = await queryRunner.hasColumn('users', 'phone');
    if (!hasPhone) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "phone" VARCHAR(15)
      `);

      await queryRunner.query(`
        COMMENT ON COLUMN "users"."phone" IS 'User phone number in E.164 format'
      `);
    }

    // Check constraint existence via system catalog since TypeORM doesn't have hasConstraint easily available for all drivers
    // But for Postgres we can use safe SQL or a try-catch, or just a raw query with DO block which is robust for Postgres.
    // Given the user wants "checks", I'll stick to the DO block for the constraint which is standard Postgres safety.
    await queryRunner.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_phone') THEN
              ALTER TABLE "users"
              ADD CONSTRAINT "CHK_phone" CHECK (phone ~ '^\\+?[1-9]\\d{1,14}$' OR phone IS NULL);
          END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`,
    );
  }
}

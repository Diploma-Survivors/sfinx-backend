import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePhoneConstraint1771078316952 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const hasConstraint = table?.checks.some((c) => c.name === 'CHK_phone');
    if (hasConstraint) {
      await queryRunner.query(
        `ALTER TABLE "users" DROP CONSTRAINT "CHK_phone"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ADD CONSTRAINT "CHK_phone" CHECK (phone ~ '^\\+?[1-9]\\d{1,14}$' OR phone IS NULL);`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPremiumIndex1769332969213 implements MigrationInterface {
  name = 'AddUserPremiumIndex1769332969213';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_users_is_premium" 
            ON "users" ("is_premium")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_premium"`);
  }
}

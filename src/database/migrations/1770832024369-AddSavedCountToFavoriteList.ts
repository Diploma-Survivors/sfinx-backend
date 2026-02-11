import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedCountToFavoriteList1770832024369 implements MigrationInterface {
  name = 'AddSavedCountToFavoriteList1770832024369';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" ADD "saved_count" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" DROP COLUMN "saved_count"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsEditorialToSolutions1772730382023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solutions" ADD COLUMN "is_editorial" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solutions" DROP COLUMN "is_editorial"`,
    );
  }
}

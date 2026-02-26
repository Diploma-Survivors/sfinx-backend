import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDraftToProblem1772081982857 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column with DEFAULT false so existing problems are treated as already published
    await queryRunner.query(
      `ALTER TABLE "problems" ADD COLUMN "is_draft" boolean NOT NULL DEFAULT false`,
    );
    // Then change the default to true so new problems start as drafts
    await queryRunner.query(
      `ALTER TABLE "problems" ALTER COLUMN "is_draft" SET DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "problems" DROP COLUMN "is_draft"`);
  }
}

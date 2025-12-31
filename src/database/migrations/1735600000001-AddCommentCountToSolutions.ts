import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentCountToSolutions1735600000001 implements MigrationInterface {
  name = 'AddCommentCountToSolutions1735600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Safe check using hasColumn is better, or DO block
    const table = await queryRunner.getTable('solutions');
    const column = table?.findColumnByName('comment_count');

    if (!column) {
      await queryRunner.query(
        `ALTER TABLE "solutions" ADD "comment_count" integer NOT NULL DEFAULT '0'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solutions" DROP COLUMN "comment_count"`,
    );
  }
}

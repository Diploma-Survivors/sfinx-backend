import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpDownVote1770317804118 implements MigrationInterface {
  name = 'AddUpDownVote1770317804118';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discuss_posts" ADD "downvote_count" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discuss_posts" DROP COLUMN "downvote_count"`,
    );
  }
}

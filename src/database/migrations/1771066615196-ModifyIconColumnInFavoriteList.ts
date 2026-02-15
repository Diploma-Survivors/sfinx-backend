import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifyIconColumnInFavoriteList1771066615196 implements MigrationInterface {
  name = 'ModifyIconColumnInFavoriteList1771066615196';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" ALTER COLUMN "icon" TYPE varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" ALTER COLUMN "icon" SET DEFAULT 'https://play-lh.googleusercontent.com/2X1xHmYDF33roRwWqJOUgiFvF4Bi8fUbaw3mkODIasg68WIJM_9kmA9akRZUi3k5jaZ278RqpB4vatLOMRSKERc'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" ALTER COLUMN "icon" TYPE varchar(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" ALTER COLUMN "icon" SET DEFAULT '📝'`,
    );
  }
}

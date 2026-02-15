import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContestRatingToUserStatistics1771070550149 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_statistics"
                ADD "contest_rating" integer NOT NULL DEFAULT 1500,
                ADD "contests_participated" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_statistics"
                DROP COLUMN "contests_participated",
                DROP COLUMN "contest_rating"`,
    );
  }
}

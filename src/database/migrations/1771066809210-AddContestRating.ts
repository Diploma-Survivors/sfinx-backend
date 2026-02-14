import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContestRating1771066809210 implements MigrationInterface {
  name = 'AddContestRating1771066809210';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add per-contest rating snapshot fields to contest_participants
    await queryRunner.query(
      `ALTER TABLE "contest_participants"
        ADD "rating_before" integer,
        ADD "rating_after" integer,
        ADD "rating_delta" integer,
        ADD "contest_rank" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contest_participants"
        DROP COLUMN "contest_rank",
        DROP COLUMN "rating_delta",
        DROP COLUMN "rating_after",
        DROP COLUMN "rating_before"`,
    );
  }
}

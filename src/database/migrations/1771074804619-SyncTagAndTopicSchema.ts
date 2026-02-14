import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncTagAndTopicSchema1771074804619 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('tags', 'problem_count'))
      await queryRunner.dropColumn('tags', 'problem_count');

    if (await queryRunner.hasColumn('topics', 'problem_count'))
      await queryRunner.dropColumn('topics', 'problem_count');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('tags', 'problem_count')))
      await queryRunner.query(
        `ALTER TABLE "tags" ADD COLUMN "problem_count" integer NOT NULL DEFAULT 0`,
      );

    if (!(await queryRunner.hasColumn('topics', 'problem_count')))
      await queryRunner.query(
        `ALTER TABLE "topics" ADD COLUMN "problem_count" integer NOT NULL DEFAULT 0`,
      );
  }
}

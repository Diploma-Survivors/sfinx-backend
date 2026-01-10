import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoteScoreToSolutions1767260000000 implements MigrationInterface {
  name = 'AddVoteScoreToSolutions1767260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add vote_score column to solutions table
    await queryRunner.query(`
      ALTER TABLE "solutions"
      ADD COLUMN IF NOT EXISTS "vote_score" INTEGER NOT NULL DEFAULT 0
    `);

    // Create index for vote_score for sorting
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solutions_vote_score"
      ON "solutions" ("vote_score" DESC)
    `);

    // Calculate initial vote_score from existing upvote/downvote counts
    await queryRunner.query(`
      UPDATE "solutions"
      SET "vote_score" = "upvote_count" - "downvote_count"
      WHERE "vote_score" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_solutions_vote_score"`);

    // Drop column
    await queryRunner.query(`
      ALTER TABLE "solutions"
      DROP COLUMN IF EXISTS "vote_score"
    `);
  }
}

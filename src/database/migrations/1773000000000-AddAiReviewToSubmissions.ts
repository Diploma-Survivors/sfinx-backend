import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiReviewToSubmissions1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "submissions" 
      ADD COLUMN IF NOT EXISTS "ai_review" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "submissions" 
      DROP COLUMN IF EXISTS "ai_review"
    `);
  }
}

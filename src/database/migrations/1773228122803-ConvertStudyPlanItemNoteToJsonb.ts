import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertStudyPlanItemNoteToJsonb1773228122803 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert existing text notes to JSONB with "en" key, then alter column type
    await queryRunner.query(`
      ALTER TABLE "study_plan_items"
      ALTER COLUMN "note" TYPE jsonb
      USING CASE
        WHEN "note" IS NOT NULL THEN jsonb_build_object('en', "note")
        ELSE NULL
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Convert back: extract "en" value as text
    await queryRunner.query(`
      ALTER TABLE "study_plan_items"
      ALTER COLUMN "note" TYPE text
      USING "note"->>'en'
    `);
  }
}

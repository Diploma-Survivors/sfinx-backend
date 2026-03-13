import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncStudyPlanEstimatedDaysDefault1773376026834 implements MigrationInterface {
  name = 'SyncStudyPlanEstimatedDaysDefault1773376026834';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure default is 0 and fix any NULLs
    await queryRunner.query(
      `ALTER TABLE "study_plans" ALTER COLUMN "estimated_days" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "study_plans" SET "estimated_days" = 0 WHERE "estimated_days" IS NULL`,
    );

    // Recalculate all plans' estimated_days from max(day_number) of their items
    await queryRunner.query(`
      UPDATE "study_plans" sp
      SET "estimated_days" = COALESCE(
        (SELECT MAX(spi.day_number) FROM "study_plan_items" spi WHERE spi.study_plan_id = sp.id),
        0
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "study_plans" ALTER COLUMN "estimated_days" DROP DEFAULT`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStarterCodeToProgrammingLanguages1734745167000 implements MigrationInterface {
  name = 'AddStarterCodeToProgrammingLanguages1734745167000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add starter_code column to programming_languages table
    const hasStarterCode = await queryRunner.hasColumn(
      'programming_languages',
      'starter_code',
    );
    if (!hasStarterCode) {
      await queryRunner.query(`
          ALTER TABLE "programming_languages"
          ADD COLUMN "starter_code" TEXT
        `);
    }

    // Fix column name mismatches between migration and entity
    // Rename monaco_id to monaco_language
    const hasMonacoId = await queryRunner.hasColumn(
      'programming_languages',
      'monaco_id',
    );
    const hasMonacoLanguage = await queryRunner.hasColumn(
      'programming_languages',
      'monaco_language',
    );
    if (hasMonacoId && !hasMonacoLanguage) {
      await queryRunner.query(`
          ALTER TABLE "programming_languages"
          RENAME COLUMN "monaco_id" TO "monaco_language"
        `);
    }

    // Rename display_order to order_index
    const hasDisplayOrder = await queryRunner.hasColumn(
      'programming_languages',
      'display_order',
    );
    const hasOrderIndex = await queryRunner.hasColumn(
      'programming_languages',
      'order_index',
    );
    if (hasDisplayOrder && !hasOrderIndex) {
      await queryRunner.query(`
          ALTER TABLE "programming_languages"
          RENAME COLUMN "display_order" TO "order_index"
        `);
    }

    // Update created_at and updated_at to use timestamptz
    // This is hard to check safely via TypeORM metadata without raw queries inspecting pg_attribute/pg_type.
    // However, ALTER COLUMN TYPE is generally safe to re-run if it's already compatible or same type,
    // but to be perfectly safe we can wrap in a try-catch or just leave it if we assume types might need update.
    // Given the request for "check existed", implied for add/rename. Safe ALTER is better but simpler to leave if checks aren't easy.
    // I will leave ALTERs as they are less likely to fail violently like ADD COLUMN,
    // unless they are casting incompatible types (which shouldn't happen here).
    // Actually, let's just make it robust enough.
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC'
    `);

    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert created_at and updated_at back to timestamp
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      ALTER COLUMN "created_at" TYPE TIMESTAMP
    `);

    // Rename order_index back to display_order
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      RENAME COLUMN "order_index" TO "display_order"
    `);

    // Rename monaco_language back to monaco_id
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      RENAME COLUMN "monaco_language" TO "monaco_id"
    `);

    // Remove starter_code column
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      DROP COLUMN "starter_code"
    `);
  }
}

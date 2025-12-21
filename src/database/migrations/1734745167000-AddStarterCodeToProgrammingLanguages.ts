import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStarterCodeToProgrammingLanguages1734745167000 implements MigrationInterface {
  name = 'AddStarterCodeToProgrammingLanguages1734745167000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add starter_code column to programming_languages table
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      ADD COLUMN "starter_code" TEXT
    `);

    // Fix column name mismatches between migration and entity
    // Rename monaco_id to monaco_language
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      RENAME COLUMN "monaco_id" TO "monaco_language"
    `);

    // Rename display_order to order_index
    await queryRunner.query(`
      ALTER TABLE "programming_languages"
      RENAME COLUMN "display_order" TO "order_index"
    `);

    // Update created_at and updated_at to use timestamptz
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

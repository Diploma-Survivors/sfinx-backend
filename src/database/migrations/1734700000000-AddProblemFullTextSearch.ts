import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProblemFullTextSearch1734700000000 implements MigrationInterface {
  name = 'AddProblemFullTextSearch1734700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tsvector column for full-text search
    await queryRunner.query(`
      ALTER TABLE "problems"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    `);

    // Create GIN index for fast full-text search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_problems_search_vector"
      ON "problems"
      USING GIN ("search_vector")
    `);

    // Create function to update search vector
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_problems_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to automatically update search vector
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_problems_search_vector_update" ON "problems"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_problems_search_vector_update"
      BEFORE INSERT OR UPDATE OF title, description
      ON "problems"
      FOR EACH ROW
      EXECUTE FUNCTION update_problems_search_vector();
    `);

    // Populate existing records with search vectors
    await queryRunner.query(`
      UPDATE "problems"
      SET search_vector =
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_problems_search_vector_update"
      ON "problems"
    `);

    // Drop function
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS update_problems_search_vector()
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_problems_search_vector"
    `);

    // Drop column
    await queryRunner.query(`
      ALTER TABLE "problems"
      DROP COLUMN IF EXISTS "search_vector"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProviderCostRecords1773450000000 implements MigrationInterface {
  name = 'CreateProviderCostRecords1773450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "provider_cost_records" (
        "id"                SERIAL PRIMARY KEY,
        "provider"          VARCHAR(50)    NOT NULL,
        "period_start"      TIMESTAMPTZ    NOT NULL,
        "period_end"        TIMESTAMPTZ    NOT NULL,
        "raw_metrics"       JSONB          NOT NULL,
        "computed_cost_usd" DECIMAL(12, 6) NOT NULL,
        "fetched_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_provider_cost_records_provider_period"
          UNIQUE ("provider", "period_start", "period_end")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_provider_cost_records_provider_period"
        ON "provider_cost_records" ("provider", "period_start" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_provider_cost_records_provider_period"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_cost_records"`);
  }
}

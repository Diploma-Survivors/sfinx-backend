import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentTransactionMoneySnapshots1773510092065 implements MigrationInterface {
  name = 'AddPaymentTransactionMoneySnapshots1773510092065';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD COLUMN IF NOT EXISTS "plan_price_vnd" numeric(15,2),
      ADD COLUMN IF NOT EXISTS "plan_price_usd" numeric(15,2),
      ADD COLUMN IF NOT EXISTS "user_paid_amount" numeric(15,2),
      ADD COLUMN IF NOT EXISTS "user_paid_currency" character varying(3),
      ADD COLUMN IF NOT EXISTS "system_received_amount" numeric(15,2),
      ADD COLUMN IF NOT EXISTS "system_received_currency" character varying(3),
      ADD COLUMN IF NOT EXISTS "system_received_amount_vnd" numeric(15,2),
      ADD COLUMN IF NOT EXISTS "system_received_amount_usd" numeric(15,2)
    `);

    await queryRunner.query(`
      WITH config AS (
        SELECT
          COALESCE(
            (SELECT rate_to_vnd FROM currencies WHERE code = 'USD' LIMIT 1),
            25500
          ) AS usd_rate,
          COALESCE(
            (SELECT value FROM fee_configs WHERE code = 'GATEWAY_FEE' AND is_active = true LIMIT 1),
            0
          ) AS gateway_fee
      )
      UPDATE payment_transactions pt
      SET
        plan_price_vnd = COALESCE(
          pt.plan_price_vnd,
          ROUND((pt.base_price_snapshot * (1 + COALESCE(pt.total_fee_percentage, 0)))::numeric, 2)
        ),
        plan_price_usd = COALESCE(
          pt.plan_price_usd,
          ROUND(
            (
              (pt.base_price_snapshot * (1 + COALESCE(pt.total_fee_percentage, 0)))
              / NULLIF((SELECT usd_rate FROM config), 0)
            )::numeric,
            2
          )
        ),
        user_paid_amount = COALESCE(pt.user_paid_amount, pt.amount),
        user_paid_currency = COALESCE(pt.user_paid_currency, pt.currency, 'VND'),
        system_received_amount = COALESCE(
          pt.system_received_amount,
          ROUND((COALESCE(pt.amount, 0) * (1 - (SELECT gateway_fee FROM config)))::numeric, 2)
        ),
        system_received_currency = COALESCE(pt.system_received_currency, pt.currency, 'VND'),
        system_received_amount_vnd = COALESCE(
          pt.system_received_amount_vnd,
          CASE
            WHEN COALESCE(pt.currency, 'VND') = 'USD'
              THEN ROUND((COALESCE(pt.amount, 0) * (SELECT usd_rate FROM config))::numeric, 2)
            ELSE ROUND(COALESCE(pt.amount, 0)::numeric, 2)
          END
        ),
        system_received_amount_usd = COALESCE(
          pt.system_received_amount_usd,
          CASE
            WHEN COALESCE(pt.currency, 'VND') = 'USD'
              THEN ROUND(COALESCE(pt.amount, 0)::numeric, 2)
            ELSE ROUND((COALESCE(pt.amount, 0) / NULLIF((SELECT usd_rate FROM config), 0))::numeric, 2)
          END
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_transactions_provider_transaction_id_unique"
      ON "payment_transactions" ("provider", "transaction_id")
      WHERE "transaction_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payment_transactions_provider_transaction_id_unique"
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      DROP COLUMN IF EXISTS "system_received_amount_usd",
      DROP COLUMN IF EXISTS "system_received_amount_vnd",
      DROP COLUMN IF EXISTS "system_received_currency",
      DROP COLUMN IF EXISTS "system_received_amount",
      DROP COLUMN IF EXISTS "user_paid_currency",
      DROP COLUMN IF EXISTS "user_paid_amount",
      DROP COLUMN IF EXISTS "plan_price_usd",
      DROP COLUMN IF EXISTS "plan_price_vnd"
    `);
  }
}

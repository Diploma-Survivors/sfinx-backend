import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullifySystemReceivedForPendingPayments1773557346453 implements MigrationInterface {
  name = 'NullifySystemReceivedForPendingPayments1773557346453';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Set all system_received columns to NULL for PENDING payments
    // System received amounts should only be calculated when payment is actually successful
    await queryRunner.query(`
      UPDATE "payment_transactions"
      SET
        "system_received_amount" = NULL,
        "system_received_currency" = NULL,
        "system_received_amount_vnd" = NULL,
        "system_received_amount_usd" = NULL
      WHERE "status" = 'PENDING' or "status" = 'FAILED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert by recalculating system received amounts for PENDING payments
    // This restores the pre-fix state (though in practice this won't be called)
    await queryRunner.query(`
      WITH config AS (
        SELECT
          COALESCE(
            (SELECT rate_to_vnd FROM currencies WHERE code = 'USD' LIMIT 1),
            25500
          ) AS usd_rate,
          COALESCE(
            (SELECT value FROM fee_configs WHERE code = 'GATEWAY_FEE' AND is_active = true LIMIT 1),
            0.029
          ) AS gateway_fee
      )
      UPDATE "payment_transactions" pt
      SET
        system_received_amount = ROUND((COALESCE(pt.amount, 0) * (1 - (SELECT gateway_fee FROM config)))::numeric, 2),
        system_received_currency = COALESCE(pt.currency, 'VND'),
        system_received_amount_vnd = CASE
          WHEN COALESCE(pt.currency, 'VND') = 'USD'
            THEN ROUND((COALESCE(pt.amount, 0) * (SELECT usd_rate FROM config))::numeric, 2)
          ELSE ROUND(COALESCE(pt.amount, 0)::numeric, 2)
        END,
        system_received_amount_usd = CASE
          WHEN COALESCE(pt.currency, 'VND') = 'USD'
            THEN ROUND(COALESCE(pt.amount, 0)::numeric, 2)
          ELSE ROUND((COALESCE(pt.amount, 0) / NULLIF((SELECT usd_rate FROM config), 0))::numeric, 2)
        END
      WHERE pt.status = 'PENDING'
    `);
  }
}

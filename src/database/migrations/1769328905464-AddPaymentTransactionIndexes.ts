import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentTransactionIndexes1769328905464 implements MigrationInterface {
  name = 'AddPaymentTransactionIndexes1769328905464';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index for Churn Rate (LEAD) and Active Subscribers (filtering)
    // (status, user_id, payment_date) covers the WHERE clause and sorting order for LEAD
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_pt_status_user_date" 
            ON "payment_transactions" ("status", "user_id", "payment_date")
        `);

    // Index for Plan Joins (if needed, though standard FK index usually exists, composite helps)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_pt_status_plan_date" 
            ON "payment_transactions" ("status", "plan_id", "payment_date")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pt_status_plan_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pt_status_user_date"`);
  }
}

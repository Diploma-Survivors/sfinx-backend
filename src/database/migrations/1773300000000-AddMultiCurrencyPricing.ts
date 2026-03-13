import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiCurrencyPricing1773300000000 implements MigrationInterface {
  name = 'AddMultiCurrencyPricing1773300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create currencies table
    await queryRunner.query(`
      CREATE TABLE "currencies" (
        "id" SERIAL NOT NULL,
        "code" character varying(3) NOT NULL,
        "name" character varying(50) NOT NULL,
        "symbol" character varying(5) NOT NULL,
        "rate_to_vnd" numeric(15,4) NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_currencies_code" UNIQUE ("code"),
        CONSTRAINT "PK_currencies" PRIMARY KEY ("id")
      )
    `);

    // 2. Create fee_configs table
    await queryRunner.query(`
      CREATE TABLE "fee_configs" (
        "id" SERIAL NOT NULL,
        "code" character varying(50) NOT NULL,
        "value" numeric(10,6) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_fee_configs_code" UNIQUE ("code"),
        CONSTRAINT "PK_fee_configs" PRIMARY KEY ("id")
      )
    `);

    // 3. Migrate subscription_plans: rename price_usd -> base_price, convert USD to VND
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        ADD COLUMN "base_price" numeric(15,2)
    `);
    // Migrate existing USD prices to VND (multiplier = 26,293)
    await queryRunner.query(`
      UPDATE "subscription_plans"
        SET "base_price" = "price_usd" * 26,293
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        ALTER COLUMN "base_price" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        DROP COLUMN "price_usd"
    `);

    // 4. Migrate payment_transactions: restructure for VND-anchored model
    // Add new columns
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        ADD COLUMN "base_price_snapshot" numeric(15,2) DEFAULT 0,
        ADD COLUMN "total_fee_percentage" numeric(10,6) DEFAULT 0
    `);
    // Migrate: set base_price_snapshot from amount (was USD), convert to VND
    await queryRunner.query(`
      UPDATE "payment_transactions"
        SET "base_price_snapshot" = "amount" * "exchange_rate",
            "amount" = "amount_vnd",
            "currency" = 'VND'
    `);
    // Drop old columns
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        DROP COLUMN "amount_vnd",
        DROP COLUMN "exchange_rate"
    `);
    // Update amount column precision for VND
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        ALTER COLUMN "amount" TYPE numeric(15,2)
    `);
    // Update currency default
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        ALTER COLUMN "currency" SET DEFAULT 'VND'
    `);

    // 5. Seed default currencies
    await queryRunner.query(`
      INSERT INTO "currencies" ("code", "name", "symbol", "rate_to_vnd", "is_active") VALUES
        ('VND', 'Vietnamese Dong', 'đ', 1, true),
        ('USD', 'US Dollar', '$', 25500, true)
    `);

    // 6. Seed default fee configs
    await queryRunner.query(`
      INSERT INTO "fee_configs" ("code", "value", "is_active") VALUES
        ('VAT', 0.10, true),
        ('GATEWAY_FEE', 0.015, true),
        ('EXCHANGE_RISK', 0.005, true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse fee config translations
    await queryRunner.query(`DELETE FROM "fee_config_translations"`);

    // Reverse fee configs and currencies
    await queryRunner.query(`DELETE FROM "fee_configs"`);
    await queryRunner.query(`DELETE FROM "currencies"`);
    await queryRunner.query(`DELETE FROM "currency_translations"`);

    // Reverse payment_transactions changes
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        ADD COLUMN "amount_vnd" numeric(15,2) DEFAULT 0,
        ADD COLUMN "exchange_rate" numeric(10,2) DEFAULT 26,293
    `);
    await queryRunner.query(`
      UPDATE "payment_transactions"
        SET "amount_vnd" = "amount",
            "amount" = "base_price_snapshot" / 26,293,
            "exchange_rate" = 26,293,
            "currency" = 'USD'
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        ALTER COLUMN "amount" TYPE numeric(10,2),
        ALTER COLUMN "currency" SET DEFAULT 'USD'
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        DROP COLUMN "base_price_snapshot",
        DROP COLUMN "total_fee_percentage"
    `);

    // Reverse subscription_plans changes
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        ADD COLUMN "price_usd" numeric(10,2)
    `);
    await queryRunner.query(`
      UPDATE "subscription_plans"
        SET "price_usd" = "base_price" / 26,293
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        ALTER COLUMN "price_usd" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        DROP COLUMN "base_price"
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE "fee_configs"`);
    await queryRunner.query(`DROP TABLE "currencies"`);
  }
}

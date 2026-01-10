import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsModule1767120250440 implements MigrationInterface {
  name = 'CreatePaymentsModule1767120250440';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_plans_type_enum" AS ENUM('MONTHLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_plans" ("id" SERIAL NOT NULL, "type" "public"."subscription_plans_type_enum" NOT NULL DEFAULT 'MONTHLY', "price_usd" numeric(10,2) NOT NULL, "duration_months" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9ab8fe6918451ab3d0a4fb6bb0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_plan_translations" ("id" SERIAL NOT NULL, "plan_id" integer NOT NULL, "language_code" character varying(10) NOT NULL, "name" character varying(100) NOT NULL, "description" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_subscription_plan_translations_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."payment_transactions_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_transactions" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "plan_id" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "amount_vnd" numeric(15,2) NOT NULL, "exchange_rate" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "provider" character varying(20) NOT NULL DEFAULT 'VNPAY', "transaction_id" character varying, "description" character varying, "status" "public"."payment_transactions_status_enum" NOT NULL DEFAULT 'PENDING', "payment_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d32b3c6b0d2c1d22604cbcc8c49" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "subscription_plan_translations" ADD CONSTRAINT "FK_subscription_plan_translations_plan" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_77fab0556decc83a81a5bf8c25d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_2c4abef218e0e4914103c81c69f" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_2c4abef218e0e4914103c81c69f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_77fab0556decc83a81a5bf8c25d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_plan_translations" DROP CONSTRAINT "FK_subscription_plan_translations_plan"`,
    );

    await queryRunner.query(`DROP TABLE "payment_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."payment_transactions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_plan_translations"`);
    await queryRunner.query(`DROP TABLE "subscription_plans"`);
    await queryRunner.query(
      `DROP TYPE "public"."subscription_plans_type_enum"`,
    );
  }
}

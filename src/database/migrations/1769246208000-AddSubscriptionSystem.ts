import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionSystem1769246208000 implements MigrationInterface {
  name = 'AddSubscriptionSystem1769246208000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Subscription Features Table
    await queryRunner.query(`
            CREATE TABLE "subscription_features" (
                "id" SERIAL NOT NULL,
                "key" character varying(50) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_subscription_features_key" UNIQUE ("key"),
                CONSTRAINT "PK_subscription_features" PRIMARY KEY ("id")
            )
        `);

    // 2. Create Subscription Feature Translations Table
    await queryRunner.query(`
            CREATE TABLE "subscription_feature_translations" (
                "id" SERIAL NOT NULL,
                "feature_id" integer NOT NULL,
                "language_code" character varying(10) NOT NULL,
                "name" character varying(100) NOT NULL,
                "description" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscription_feature_translations" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            ALTER TABLE "subscription_feature_translations" 
            ADD CONSTRAINT "FK_feature_translations_feature_id" 
            FOREIGN KEY ("feature_id") REFERENCES "subscription_features"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // 6. Create Subscription Plan Features (Junction) Table
    await queryRunner.query(`
            CREATE TABLE "subscription_plan_features" (
                "plan_id" integer NOT NULL,
                "feature_id" integer NOT NULL,
                CONSTRAINT "PK_subscription_plan_features" PRIMARY KEY ("plan_id", "feature_id")
            )
        `);

    await queryRunner.query(`
            ALTER TABLE "subscription_plan_features" 
            ADD CONSTRAINT "FK_plan_features_plan_id" 
            FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "subscription_plan_features" 
            ADD CONSTRAINT "FK_plan_features_feature_id" 
            FOREIGN KEY ("feature_id") REFERENCES "subscription_features"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order of dependency
    await queryRunner.query(
      `ALTER TABLE "subscription_plan_features" DROP CONSTRAINT "FK_plan_features_feature_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_plan_features" DROP CONSTRAINT "FK_plan_features_plan_id"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_plan_features"`);

    await queryRunner.query(
      `ALTER TABLE "subscription_feature_translations" DROP CONSTRAINT "FK_feature_translations_feature_id"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_feature_translations"`);

    await queryRunner.query(`DROP TABLE "subscription_features"`);
  }
}

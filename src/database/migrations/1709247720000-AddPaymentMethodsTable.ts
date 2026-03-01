import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodsTable1709247720000 implements MigrationInterface {
  name = 'AddPaymentMethodsTable1709247720000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_methods_method_enum') THEN
          CREATE TYPE "payment_methods_method_enum" AS ENUM ('0');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_methods" (
        "id" SERIAL NOT NULL,
        "method" "payment_methods_method_enum" NOT NULL,
        "icon_url" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_methods_method" UNIQUE ("method"),
        CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_method_translations" (
        "id" SERIAL NOT NULL,
        "payment_method_id" integer NOT NULL,
        "language_code" character varying(10) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_method_translations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_payment_method_translations_method_id'
        ) THEN
          ALTER TABLE "payment_method_translations"
          ADD CONSTRAINT "FK_payment_method_translations_method_id"
          FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payment_method_translations" DROP CONSTRAINT IF EXISTS "FK_payment_method_translations_method_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "payment_method_translations"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_methods"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "payment_methods_method_enum"`,
    );
  }
}

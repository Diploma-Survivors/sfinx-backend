import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeeCurrencyTranslations1773400000000 implements MigrationInterface {
  name = 'AddFeeCurrencyTranslations1773400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fee_config_translations" (
        "id" SERIAL NOT NULL,
        "fee_config_id" integer NOT NULL,
        "language_code" character varying(10) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_fee_config_translation_lang" UNIQUE ("fee_config_id", "language_code"),
        CONSTRAINT "PK_fee_config_translations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "currency_translations" (
        "id" SERIAL NOT NULL,
        "currency_id" integer NOT NULL,
        "language_code" character varying(10) NOT NULL,
        "name" character varying(100) NOT NULL,
        "symbol" character varying(5),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_currency_translation_lang" UNIQUE ("currency_id", "language_code"),
        CONSTRAINT "PK_currency_translations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "fee_config_translations"
      ADD CONSTRAINT "FK_fee_config_translations_fee_config"
      FOREIGN KEY ("fee_config_id") REFERENCES "fee_configs"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "currency_translations"
      ADD CONSTRAINT "FK_currency_translations_currency"
      FOREIGN KEY ("currency_id") REFERENCES "currencies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      INSERT INTO "fee_config_translations" ("fee_config_id", "language_code", "name", "description") VALUES
        (1, 'en', 'Value Added Tax', 'Applicable sales tax'),
        (1, 'vi', 'Thuế GTGT', 'Thuế giá trị gia tăng áp dụng'),
        (2, 'en', 'Payment Gateway Fee', 'Payment processing fee'),
        (2, 'vi', 'Phí thanh toán', 'Phí xử lý qua cổng thanh toán'),
        (3, 'en', 'Exchange Rate Risk Buffer', 'Currency fluctuation buffer'),
        (3, 'vi', 'Phí dự phòng tỷ giá', 'Phí bù đắp rủi ro biến động tỷ giá')
    `);

    await queryRunner.query(`
      INSERT INTO "currency_translations" ("currency_id", "language_code", "name", "symbol") VALUES
        (1, 'en', 'Vietnamese Dong', '₫'),
        (1, 'vi', 'Đồng Việt Nam', '₫'),
        (2, 'en', 'US Dollar', '$'),
        (2, 'vi', 'Đô la Mỹ', '$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "currency_translations"
      DROP CONSTRAINT "FK_currency_translations_currency"
    `);

    await queryRunner.query(`
      ALTER TABLE "fee_config_translations"
      DROP CONSTRAINT "FK_fee_config_translations_fee_config"
    `);

    await queryRunner.query(`DROP TABLE "currency_translations"`);
    await queryRunner.query(`DROP TABLE "fee_config_translations"`);
  }
}

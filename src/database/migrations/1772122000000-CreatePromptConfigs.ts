import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromptConfigs1772122000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prompt_configs" (
        "id"                   SERIAL NOT NULL,
        "feature_name"         character varying(100) NOT NULL,
        "description"          text,
        "langfuse_prompt_name" character varying(200) NOT NULL,
        "langfuse_label"       character varying(50) NOT NULL DEFAULT 'production',
        "is_active"            boolean NOT NULL DEFAULT true,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_prompt_configs_feature_name" UNIQUE ("feature_name"),
        CONSTRAINT "PK_prompt_configs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "prompt_configs"`);
  }
}

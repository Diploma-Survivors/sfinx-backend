import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedProviderCostParams1773450000001 implements MigrationInterface {
  name = 'SeedProviderCostParams1773450000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_parameters" ("key", "value", "description") VALUES
        ('DEEPGRAM_PRICE_PER_AUDIO_MINUTE', '0.0043', 'USD per audio minute — Deepgram Nova-2 base'),
        ('ELEVEN_PRICE_PER_1K_CHARS',       '0.30',   'USD per 1,000 characters — ElevenLabs Starter tier'),
        ('BREVO_MONTHLY_PLAN_COST_USD',     '25.00',  'Flat monthly fee for Brevo plan — update manually when plan changes'),
        ('LANGSMITH_PRICE_PER_1K_TRACES',   '0.00',   'USD per 1,000 traces — LangSmith free tier default')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "system_parameters"
      WHERE "key" IN (
        'DEEPGRAM_PRICE_PER_AUDIO_MINUTE',
        'ELEVEN_PRICE_PER_1K_CHARS',
        'BREVO_MONTHLY_PLAN_COST_USD',
        'LANGSMITH_PRICE_PER_1K_TRACES'
      )
    `);
  }
}

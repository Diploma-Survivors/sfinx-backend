import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLanguageToInterviews1773100000000 implements MigrationInterface {
  name = 'AddLanguageToInterviews1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_interviews
      ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en'
    `);

    await queryRunner.query(`
      CREATE INDEX idx_ai_interviews_language ON ai_interviews(language)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_ai_interviews_language`);
    await queryRunner.query(`ALTER TABLE ai_interviews DROP COLUMN language`);
  }
}

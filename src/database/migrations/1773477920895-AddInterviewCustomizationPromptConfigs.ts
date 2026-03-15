import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterviewCustomizationPromptConfigs1773477920895 implements MigrationInterface {
  name = 'AddInterviewCustomizationPromptConfigs1773477920895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert prompt configurations for interview customization
    await queryRunner.query(`
      INSERT INTO prompt_configs (feature_name, description, langfuse_prompt_name, langfuse_label, is_active, created_at, updated_at) 
      VALUES 
        ('personality-easy-going', 'Easy going interviewer personality', 'personality-easy-going', 'production', true, NOW(), NOW()),
        ('personality-strict', 'Strict interviewer personality', 'personality-strict', 'production', true, NOW(), NOW()),
        ('personality-jackass', 'Jackass interviewer personality', 'personality-jackass', 'production', true, NOW(), NOW()),
        ('difficulty-entry', 'Entry level difficulty expectations', 'difficulty-entry', 'production', true, NOW(), NOW()),
        ('difficulty-experienced', 'Experienced level difficulty expectations', 'difficulty-experienced', 'production', true, NOW(), NOW()),
        ('difficulty-senior', 'Senior level difficulty expectations', 'difficulty-senior', 'production', true, NOW(), NOW()),
        ('time-30min', '30 minute interview time constraint', 'time-30min', 'production', true, NOW(), NOW()),
        ('time-45min', '45 minute interview time constraint', 'time-45min', 'production', true, NOW(), NOW()),
        ('time-60min', '60 minute interview time constraint', 'time-60min', 'production', true, NOW(), NOW())
      ON CONFLICT (feature_name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the inserted prompt configurations
    await queryRunner.query(`
      DELETE FROM prompt_configs 
      WHERE feature_name IN (
        'personality-easy-going',
        'personality-strict', 
        'personality-jackass',
        'difficulty-entry',
        'difficulty-experienced',
        'difficulty-senior',
        'time-30min',
        'time-45min',
        'time-60min'
      );
    `);
  }
}

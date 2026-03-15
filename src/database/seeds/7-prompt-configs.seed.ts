import { DataSource } from 'typeorm';
import { PromptConfig } from '../../modules/ai/entities/prompt-config.entity';

const PROMPT_CONFIGS = [
  {
    featureName: 'interviewer',
    description: 'AI interviewer system prompt',
    langfusePromptName: 'interviewer',
    langfuseLabel: 'production',
  },
  {
    featureName: 'evaluator',
    description: 'AI evaluator for scoring interview transcripts',
    langfusePromptName: 'evaluator',
    langfuseLabel: 'production',
  },
  {
    featureName: 'code-reviewer',
    description: 'AI code reviewer for analyzing code submissions',
    langfusePromptName: 'code-reviewer',
    langfuseLabel: 'production',
  },
  {
    featureName: 'voice-adaptation',
    langfusePromptName: 'voice-adaptation',
    langfuseLabel: 'production',
  },
  {
    featureName: 'interviewer-vi',
    description: 'Vietnamese AI interviewer system prompt',
    langfusePromptName: 'interviewer-vi',
    langfuseLabel: 'production',
  },
  {
    featureName: 'voice-adaptation-vi',
    description: 'Vietnamese voice adaptation prompt',
    langfusePromptName: 'voice-adaptation-vi',
    langfuseLabel: 'production',
  },
  // Interview customization prompts
  {
    featureName: 'personality-easy-going',
    description: 'Easy going interviewer personality',
    langfusePromptName: 'personality-easy-going',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'personality-strict',
    description: 'Strict interviewer personality',
    langfusePromptName: 'personality-strict',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'personality-jackass',
    description: 'Jackass interviewer personality',
    langfusePromptName: 'personality-jackass',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'difficulty-entry',
    description: 'Entry level difficulty expectations',
    langfusePromptName: 'difficulty-entry',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'difficulty-experienced',
    description: 'Experienced level difficulty expectations',
    langfusePromptName: 'difficulty-experienced',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'difficulty-senior',
    description: 'Senior level difficulty expectations',
    langfusePromptName: 'difficulty-senior',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'time-30min',
    description: '30 minute interview time constraint',
    langfusePromptName: 'time-30min',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'time-45min',
    description: '45 minute interview time constraint',
    langfusePromptName: 'time-45min',
    langfuseLabel: 'latest',
  },
  {
    featureName: 'time-60min',
    description: '60 minute interview time constraint',
    langfusePromptName: 'time-60min',
    langfuseLabel: 'latest',
  },
];

export async function seedPromptConfigs(dataSource: DataSource) {
  const repo = dataSource.getRepository(PromptConfig);

  console.log('🌱 Seeding prompt configs...');

  let created = 0;
  for (const data of PROMPT_CONFIGS) {
    const existing = await repo.findOne({
      where: { featureName: data.featureName },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  ✅ Created prompt config: ${data.featureName}`);
      created++;
    } else {
      console.log(`  ℹ️  Already exists: ${data.featureName}`);
    }
  }

  console.log(`✅ Prompt configs seeded (${created} created)\n`);
}

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

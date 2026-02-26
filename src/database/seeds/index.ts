import { config } from 'dotenv';
import dataSource from '../data-source';
import { seedRolesAndPermissions } from './1-roles-permissions.seed';
import { seedProgrammingLanguages } from './2-programming-languages.seed';
import { seedTopics } from './3-topics.seed';
import { seedTags } from './4-tags.seed';
import { seedProblems } from './5-problems.seed';
import { CreateSubscriptionPlans } from './create-subscription-plans.seed';
import { CreateSubscriptionFeatures } from './create-subscription-features.seed';
import { seedDiscuss } from './6-discuss.seed';
import { seedPromptConfigs } from './7-prompt-configs.seed';

// Load environment variables
config();

async function runSeeds() {
  console.log('🚀 Starting database seeding...\n');

  try {
    // Initialize data source
    await dataSource.initialize();
    console.log('✅ Database connection established\n');

    // Run seeds in order
    await seedRolesAndPermissions(dataSource);
    await seedProgrammingLanguages(dataSource);
    await seedTopics(dataSource);
    await seedTags(dataSource);
    await seedProblems(dataSource);
    await CreateSubscriptionFeatures(dataSource);
    await CreateSubscriptionPlans(dataSource);
    await seedDiscuss(dataSource);
    await seedPromptConfigs(dataSource);

    console.log('🎉 All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('✅ Database connection closed');
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
runSeeds();

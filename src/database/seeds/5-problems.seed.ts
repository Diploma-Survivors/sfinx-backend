import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DataSource } from 'typeorm';

import { Problem } from '../../modules/problems/entities/problem.entity';
import { ProblemDifficulty } from '../../modules/problems/enums/problem-difficulty.enum';
import { SampleTestcase } from '../../modules/problems/entities/sample-testcase.entity';
import { Tag } from '../../modules/problems/entities/tag.entity';
import { Topic } from '../../modules/problems/entities/topic.entity';
import { User } from '../../modules/auth/entities/user.entity';

interface ProblemSeedData {
  title: string;
  slug: string;
  description: string;
  constraints: string;
  difficulty: string;
  isPremium: boolean;
  isPublished: boolean;
  isActive: boolean;
  timeLimitMs: number;
  memoryLimitKb: number;
  topicSlugs: string[];
  tagSlugs: string[];
  sampleTestcases: Array<{
    input: string;
    expectedOutput: string;
    orderIndex: number;
    explanation: string | null;
  }>;
  hints: Array<{
    order: number;
    content: string;
  }>;
}

export async function seedProblems(dataSource: DataSource) {
  const problemRepository = dataSource.getRepository(Problem);
  const topicRepository = dataSource.getRepository(Topic);
  const tagRepository = dataSource.getRepository(Tag);
  const sampleTestcaseRepository = dataSource.getRepository(SampleTestcase);
  const userRepository = dataSource.getRepository(User);

  console.log('🌱 Seeding problems...');

  // Get admin user from environment
  const adminEmail = process.env.ADMIN_EMAIL;
  let adminUser: User | null = null;

  if (adminEmail) {
    adminUser = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (!adminUser) {
      console.log(
        '⚠️  Admin user not found. Problems will be created without createdBy/updatedBy.\n',
      );
    }
  } else {
    console.log(
      '⚠️  ADMIN_EMAIL not set. Problems will be created without createdBy/updatedBy.\n',
    );
  }

  const filePath = resolve(__dirname, 'data/problems.json');
  const problemsData = JSON.parse(
    readFileSync(filePath, 'utf-8'),
  ) as ProblemSeedData[];

  let count = 0;
  for (const problemData of problemsData) {
    const existing = await problemRepository.findOne({
      where: { slug: problemData.slug },
    });

    if (!existing) {
      // Find topics by slugs
      const topics: Topic[] = [];
      for (const topicSlug of problemData.topicSlugs) {
        const topic = await topicRepository.findOne({
          where: { slug: topicSlug },
        });
        if (topic) {
          topics.push(topic);
        }
      }

      // Find tags by slugs
      const tags: Tag[] = [];
      for (const tagSlug of problemData.tagSlugs) {
        const tag = await tagRepository.findOne({
          where: { slug: tagSlug },
        });
        if (tag) {
          tags.push(tag);
        }
      }

      // Create problem
      const problem = problemRepository.create({
        title: problemData.title,
        slug: problemData.slug,
        description: problemData.description,
        constraints: problemData.constraints,
        difficulty: problemData.difficulty as ProblemDifficulty,
        isPremium: problemData.isPremium,
        isPublished: problemData.isPublished,
        isActive: problemData.isActive,
        timeLimitMs: problemData.timeLimitMs,
        memoryLimitKb: problemData.memoryLimitKb,
        hints: problemData.hints,
        topics,
        tags,
        ...(adminUser && { createdBy: adminUser, updatedBy: adminUser }),
      });

      const savedProblem = await problemRepository.save(problem);

      // Create sample testcases
      for (const sampleData of problemData.sampleTestcases) {
        const sample = sampleTestcaseRepository.create({
          problem: savedProblem,
          input: sampleData.input,
          expectedOutput: sampleData.expectedOutput,
          orderIndex: sampleData.orderIndex,
          explanation: sampleData.explanation ?? undefined,
        });
        await sampleTestcaseRepository.save(sample);
      }

      count++;
    }
  }

  console.log(`✅ Created ${count} problems\n`);
}

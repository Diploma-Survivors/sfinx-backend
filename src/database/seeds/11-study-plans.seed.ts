import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { User } from '../../modules/auth/entities/user.entity';
import { Problem } from '../../modules/problems/entities/problem.entity';
import { Tag } from '../../modules/problems/entities/tag.entity';
import { Topic } from '../../modules/problems/entities/topic.entity';
import { StudyPlanItem } from '../../modules/study-plans/entities/study-plan-item.entity';
import { StudyPlanTranslation } from '../../modules/study-plans/entities/study-plan-translation.entity';
import { StudyPlan } from '../../modules/study-plans/entities/study-plan.entity';
import { StudyPlanDifficulty } from '../../modules/study-plans/enums/study-plan-difficulty.enum';
import { StudyPlanStatus } from '../../modules/study-plans/enums/study-plan-status.enum';

interface StudyPlanItemData {
  problemSlug: string;
  dayNumber: number;
  orderIndex: number;
  note?: Record<string, string>;
}

interface StudyPlanTranslationData {
  name: string;
  description: string;
}

interface StudyPlanSeedData {
  slug: string;
  difficulty: string;
  status: string;
  estimatedDays: number;
  isPremium: boolean;
  topicSlugs: string[];
  tagSlugs: string[];
  translations: Record<string, StudyPlanTranslationData>;
  items: StudyPlanItemData[];
  similarPlanSlugs: string[];
}

export async function seedStudyPlans(dataSource: DataSource) {
  const planRepository = dataSource.getRepository(StudyPlan);
  const translationRepository = dataSource.getRepository(StudyPlanTranslation);
  const itemRepository = dataSource.getRepository(StudyPlanItem);
  const topicRepository = dataSource.getRepository(Topic);
  const tagRepository = dataSource.getRepository(Tag);
  const problemRepository = dataSource.getRepository(Problem);
  const userRepository = dataSource.getRepository(User);

  console.log('🌱 Seeding study plans...');

  // Get admin user
  const adminEmail = process.env.ADMIN_EMAIL;
  let adminUser: User | null = null;
  if (adminEmail) {
    adminUser = await userRepository.findOne({ where: { email: adminEmail } });
    if (!adminUser) {
      console.log(
        '  ⚠️  Admin user not found. Plans will be created without createdBy.',
      );
    }
  }

  const filePath = resolve(__dirname, 'data/study-plans.json');
  const plansData = JSON.parse(
    readFileSync(filePath, 'utf-8'),
  ) as StudyPlanSeedData[];

  // First pass: create all plans (without similarPlanIds)
  const slugToIdMap = new Map<string, number>();
  let createdCount = 0;
  let skippedCount = 0;

  for (const planData of plansData) {
    const existing = await planRepository.findOne({
      where: { slug: planData.slug },
    });

    if (existing) {
      slugToIdMap.set(planData.slug, existing.id);
      skippedCount++;
      continue;
    }

    // Resolve topics
    const topics: Topic[] = [];
    for (const topicSlug of planData.topicSlugs) {
      const topic = await topicRepository.findOne({
        where: { slug: topicSlug },
      });
      if (topic) topics.push(topic);
    }

    // Resolve tags
    const tags: Tag[] = [];
    for (const tagSlug of planData.tagSlugs) {
      const tag = await tagRepository.findOne({ where: { slug: tagSlug } });
      if (tag) tags.push(tag);
    }

    // Create plan
    const plan = planRepository.create({
      slug: planData.slug,
      difficulty: planData.difficulty as StudyPlanDifficulty,
      status: planData.status as StudyPlanStatus,
      estimatedDays: planData.estimatedDays,
      isPremium: planData.isPremium,
      similarPlanIds: [],
      topics,
      tags,
      ...(adminUser && { createdBy: adminUser }),
    });

    const savedPlan = await planRepository.save(plan);
    slugToIdMap.set(planData.slug, savedPlan.id);

    // Create translations
    for (const [lang, trans] of Object.entries(planData.translations)) {
      const translation = translationRepository.create({
        studyPlanId: savedPlan.id,
        languageCode: lang,
        name: trans.name,
        description: trans.description,
      });
      await translationRepository.save(translation);
    }

    // Create items
    let itemCount = 0;
    for (const itemData of planData.items) {
      const problem = await problemRepository.findOne({
        where: { slug: itemData.problemSlug },
      });
      if (!problem) {
        console.log(
          `  ⚠️  Problem "${itemData.problemSlug}" not found, skipping item`,
        );
        continue;
      }

      const item = itemRepository.create({
        studyPlanId: savedPlan.id,
        problemId: problem.id,
        dayNumber: itemData.dayNumber,
        orderIndex: itemData.orderIndex,
        note: itemData.note ?? null,
      });
      await itemRepository.save(item);
      itemCount++;
    }

    createdCount++;
    console.log(
      `  ✅ Created "${planData.slug}" (${planData.difficulty}, ${itemCount} problems, ${Object.keys(planData.translations).length} languages)`,
    );
  }

  // Second pass: resolve similarPlanIds now that all plans exist
  let linkedCount = 0;
  for (const planData of plansData) {
    if (!planData.similarPlanSlugs?.length) continue;

    const planId = slugToIdMap.get(planData.slug);
    if (!planId) continue;

    const similarIds = planData.similarPlanSlugs
      .map((slug) => slugToIdMap.get(slug))
      .filter((id): id is number => id !== undefined);

    if (similarIds.length) {
      await planRepository.update(planId, { similarPlanIds: similarIds });
      linkedCount++;
    }
  }

  console.log(
    `\n📊 Study plans summary: ${createdCount} created, ${skippedCount} skipped (already exist), ${linkedCount} linked with similar plans`,
  );
}

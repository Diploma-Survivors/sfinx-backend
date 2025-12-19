import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DataSource } from 'typeorm';

import { Topic } from '../../modules/problems/entities/topic.entity';

export async function seedTopics(dataSource: DataSource) {
  const topicRepository = dataSource.getRepository(Topic);

  console.log('🌱 Seeding topics...');

  const filePath = resolve(__dirname, 'data/topics.json');

  const topicsData = JSON.parse(readFileSync(filePath, 'utf-8')) as Topic[];

  let count = 0;
  for (const topicData of topicsData) {
    const existing = await topicRepository.findOne({
      where: { slug: topicData.slug },
    });

    if (!existing) {
      const topic = topicRepository.create(topicData);
      await topicRepository.save(topic);
      count++;
    }
  }

  console.log(`✅ Created ${count} topics\n`);
}

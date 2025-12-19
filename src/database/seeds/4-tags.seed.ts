import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DataSource } from 'typeorm';

import { Tag } from '../../modules/problems/entities/tag.entity';

export async function seedTags(dataSource: DataSource) {
  const tagRepository = dataSource.getRepository(Tag);

  console.log('🌱 Seeding tags...');

  const filePath = resolve(__dirname, 'data/tags.json');

  const tagsData = JSON.parse(readFileSync(filePath, 'utf-8')) as Tag[];

  let count = 0;
  for (const tagData of tagsData) {
    const existing = await tagRepository.findOne({
      where: { slug: tagData.slug },
    });

    if (!existing) {
      const tag = tagRepository.create(tagData);
      await tagRepository.save(tag);
      count++;
    }
  }

  console.log(`✅ Created ${count} tags\n`);
}

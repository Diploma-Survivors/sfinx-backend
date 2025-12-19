import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DataSource } from 'typeorm';

import { ProgrammingLanguage } from '../../modules/programming-language/entities/programming-language.entity';

export async function seedProgrammingLanguages(dataSource: DataSource) {
  const languageRepository = dataSource.getRepository(ProgrammingLanguage);

  console.log('🌱 Seeding programming languages...');

  const filePath = resolve(__dirname, 'data/languages.json');

  const languagesData = JSON.parse(
    readFileSync(filePath, 'utf-8'),
  ) as ProgrammingLanguage[];

  let count = 0;
  for (const langData of languagesData) {
    const existing = await languageRepository.findOne({
      where: { slug: langData.slug },
    });

    if (!existing) {
      const language = languageRepository.create(langData);
      await languageRepository.save(language);
      count++;
    }
  }

  console.log(`✅ Created ${count} programming languages\n`);
}

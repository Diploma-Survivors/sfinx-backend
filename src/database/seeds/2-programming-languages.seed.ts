import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DataSource } from 'typeorm';

import { ProgrammingLanguage } from '../../modules/programming-language/entities/programming-language.entity';
import { HARNESS_TEMPLATES } from './data/harness-templates';

export async function seedProgrammingLanguages(dataSource: DataSource) {
  const languageRepository = dataSource.getRepository(ProgrammingLanguage);

  console.log('🌱 Seeding programming languages...');

  const filePath = resolve(__dirname, 'data/languages.json');

  const languagesData = JSON.parse(
    readFileSync(filePath, 'utf-8'),
  ) as ProgrammingLanguage[];

  let created = 0;
  let updated = 0;

  for (const langData of languagesData) {
    const harnessCode = HARNESS_TEMPLATES[langData.slug] ?? null;

    const existing = await languageRepository.findOne({
      where: { slug: langData.slug },
    });

    if (!existing) {
      const language = languageRepository.create({
        ...langData,
        harnessCode,
      });
      await languageRepository.save(language);
      created++;
    } else if (harnessCode !== null) {
      // Update harness code for existing languages (idempotent)
      existing.harnessCode = harnessCode;
      await languageRepository.save(existing);
      updated++;
    }
  }

  console.log(
    `✅ Created ${created} programming languages, updated harness for ${updated}\n`,
  );
}

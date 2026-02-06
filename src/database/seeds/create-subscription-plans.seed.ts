import { DataSource } from 'typeorm';
import { SubscriptionPlanTranslation } from '../../modules/payments/entities/subscription-plan-translation.entity';
import {
  SubscriptionPlan,
  SubscriptionType,
} from '../../modules/payments/entities/subscription-plan.entity';
import { SubscriptionFeature } from '../../modules/payments/entities/subscription-feature.entity';

import * as fs from 'fs';
import * as path from 'path';

interface SubscriptionPlanTranslationData {
  name: string;
  description: string;
}

interface SubscriptionPlanData {
  type: SubscriptionType;
  priceUsd: number;
  durationMonths: number;
  isActive: boolean;
  featureKeys?: string[];
  translations: Record<string, SubscriptionPlanTranslationData>;
}

export const CreateSubscriptionPlans = async (dataSource: DataSource) => {
  const planRepo = dataSource.getRepository(SubscriptionPlan);
  const translationRepo = dataSource.getRepository(SubscriptionPlanTranslation);

  const plansPath = path.join(__dirname, 'data', 'subscription-plans.json');
  const plansJson = fs.readFileSync(plansPath, 'utf8');
  const plansData = JSON.parse(plansJson) as SubscriptionPlanData[];

  for (const data of plansData) {
    let plan = await planRepo.findOne({ where: { type: data.type } });

    if (!plan) {
      plan = planRepo.create({
        type: data.type,
        priceUsd: data.priceUsd,
        durationMonths: data.durationMonths,
        isActive: data.isActive,
      });
      await planRepo.save(plan);
      console.log(`Created subscription plan: ${data.type}`);
    }

    // Upsert Translations
    for (const [lang, trans] of Object.entries(data.translations)) {
      let translation = await translationRepo.findOne({
        where: { planId: plan.id, languageCode: lang },
      });

      if (!translation) {
        translation = translationRepo.create({
          planId: plan.id,
          languageCode: lang,
          name: trans.name,
          description: trans.description,
        });
      } else {
        translation.name = trans.name;
        translation.description = trans.description;
      }

      await translationRepo.save(translation);
    }

    // Link Features
    if (data.featureKeys && data.featureKeys.length > 0) {
      const pendingPlan = await planRepo.findOne({
        where: { id: plan.id },
        relations: ['features'],
      });

      const featureRepo = dataSource.getRepository('SubscriptionFeature');
      const features = (await featureRepo
        .createQueryBuilder('f')
        .where('f.key IN (:...keys)', { keys: data.featureKeys })
        .getMany()) as unknown as SubscriptionFeature[];

      if (pendingPlan) {
        pendingPlan.features = features;
        await planRepo.save(pendingPlan);
        console.log(`Linked ${features.length} features to plan ${data.type}`);
      }
    }
  }
};

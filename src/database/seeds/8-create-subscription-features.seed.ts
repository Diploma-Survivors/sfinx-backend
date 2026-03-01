import { DataSource } from 'typeorm';
import { SubscriptionFeature } from '../../modules/payments/entities/subscription-feature.entity';
import { SubscriptionFeatureTranslation } from '../../modules/payments/entities/subscription-feature-translation.entity';

export const CreateSubscriptionFeatures = async (dataSource: DataSource) => {
  const featureRepo = dataSource.getRepository(SubscriptionFeature);
  const translationRepo = dataSource.getRepository(
    SubscriptionFeatureTranslation,
  );

  const featuresData = [
    {
      key: 'unlimited_submissions',
      isActive: true,
      translations: {
        en: {
          name: 'Unlimited Submissions',
          description: 'Submit code without daily limits',
        },
        vi: {
          name: 'Không giới hạn nộp bài',
          description: 'Nộp bài không giới hạn trong ngày',
        },
      },
    },
    {
      key: 'ai_analysis',
      isActive: true,
      translations: {
        en: {
          name: 'AI Analysis',
          description: 'Get detailed AI code analysis',
        },
        vi: {
          name: 'Phân tích AI',
          description: 'Nhận phân tích chi tiết từ AI',
        },
      },
    },
    {
      key: 'premium_problems',
      isActive: true,
      translations: {
        en: {
          name: 'Premium Problems',
          description: 'Access to exclusive premium problems',
        },
        vi: {
          name: 'Bài tập cao cấp',
          description: 'Truy cập các bài tập độc quyền',
        },
      },
    },
  ];

  for (const data of featuresData) {
    let feature = await featureRepo.findOne({ where: { key: data.key } });

    if (!feature) {
      feature = featureRepo.create({
        key: data.key,
        isActive: data.isActive,
      });
      await featureRepo.save(feature);
      console.log(`Created subscription feature: ${data.key}`);
    }

    // Upsert Translations
    for (const [lang, trans] of Object.entries(data.translations)) {
      let translation = await translationRepo.findOne({
        where: { featureId: feature.id, languageCode: lang },
      });

      if (!translation) {
        translation = translationRepo.create({
          featureId: feature.id,
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
  }
};

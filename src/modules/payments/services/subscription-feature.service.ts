import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SubscriptionFeature } from '../entities/subscription-feature.entity';
import { SubscriptionFeatureTranslation } from '../entities/subscription-feature-translation.entity';
import {
  CreateSubscriptionFeatureDto,
  UpdateSubscriptionFeatureDto,
} from '../dto/create-subscription-feature.dto';

import { CACHE_TTL, Cacheable, CacheInvalidate } from '../../../common';
import { Language } from '../../auth/enums';

@Injectable()
export class SubscriptionFeatureService {
  constructor(
    @InjectRepository(SubscriptionFeature)
    private readonly featureRepository: Repository<SubscriptionFeature>,
    @InjectRepository(SubscriptionFeatureTranslation)
    private readonly translationRepository: Repository<SubscriptionFeatureTranslation>,
  ) {}

  @Cacheable({
    key: (lang: string, onlyActive: boolean) =>
      `subscription_features:all:${lang || Language.EN}:${onlyActive}`,
    ttl: CACHE_TTL.ONE_DAY,
  })
  async findAll(
    lang?: string,
    onlyActive: boolean = false,
  ): Promise<SubscriptionFeature[]> {
    const where: FindOptionsWhere<SubscriptionFeature> = {};
    if (onlyActive) {
      where.isActive = true;
    }

    const features = await this.featureRepository.find({
      where,
      relations: ['translations'],
      order: { createdAt: 'DESC' },
    });

    if (!lang) return features;

    return features.map((feature) => {
      const translation =
        feature.translations.find((t) => t.languageCode === lang) ||
        feature.translations.find((t) => t.languageCode === 'en') ||
        feature.translations[0];

      if (translation) {
        feature.translations = [translation];
      }
      return feature;
    });
  }

  async findOne(id: number): Promise<SubscriptionFeature> {
    const feature = await this.featureRepository.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!feature) {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    }

    return feature;
  }

  @CacheInvalidate({
    keys: () => [
      `subscription_features:all:${Language.EN}:true`,
      `subscription_features:all:${Language.EN}:false`,
      `subscription_features:all:${Language.VI}:true`,
      `subscription_features:all:${Language.VI}:false`,
    ],
  })
  async create(
    dto: CreateSubscriptionFeatureDto,
  ): Promise<SubscriptionFeature> {
    const feature = this.featureRepository.create({
      key: dto.key,
      isActive: dto.isActive,
    });
    await this.featureRepository.save(feature);

    if (dto.translations && dto.translations.length > 0) {
      const translations = dto.translations.map((t) =>
        this.translationRepository.create({
          feature,
          languageCode: t.languageCode,
          name: t.name,
          description: t.description || '',
        }),
      );
      await this.translationRepository.save(translations);
    }

    const createdFeature = await this.featureRepository.findOne({
      where: { id: feature.id },
      relations: ['translations'],
    });

    if (!createdFeature) {
      throw new NotFoundException(`Feature with ID ${feature.id} not found`);
    }

    return createdFeature;
  }

  @CacheInvalidate({
    keys: () => [
      `subscription_features:all:${Language.EN}:true`,
      `subscription_features:all:${Language.EN}:false`,
      `subscription_features:all:${Language.VI}:true`,
      `subscription_features:all:${Language.VI}:false`,
    ],
  })
  async update(
    id: number,
    dto: UpdateSubscriptionFeatureDto,
  ): Promise<SubscriptionFeature> {
    const feature = await this.featureRepository.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!feature) {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    }

    if (dto.isActive !== undefined) {
      feature.isActive = dto.isActive;
      await this.featureRepository.save(feature);
    }

    if (dto.translations) {
      for (const tDto of dto.translations) {
        let translation = feature.translations.find(
          (t) => t.languageCode === tDto.languageCode,
        );

        if (translation) {
          translation.name = tDto.name;
          translation.description = tDto.description || '';
        } else {
          translation = this.translationRepository.create({
            feature,
            languageCode: tDto.languageCode,
            name: tDto.name,
            description: tDto.description || '',
          });
        }
        await this.translationRepository.save(translation);
      }
    }

    const updatedFeature = await this.featureRepository.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!updatedFeature) {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    }

    return updatedFeature;
  }

  @CacheInvalidate({
    keys: () => [
      `subscription_features:all:${Language.EN}:true`,
      `subscription_features:all:${Language.EN}:false`,
      `subscription_features:all:${Language.VI}:true`,
      `subscription_features:all:${Language.VI}:false`,
    ],
  })
  async remove(id: number): Promise<void> {
    const result = await this.featureRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    }
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CACHE_TTL, Cacheable, CacheInvalidate } from '../../../common';
import { SubscriptionPlanDto } from '../dto/subscription-plan.dto';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionFeature } from '../entities/subscription-feature.entity';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { SubscriptionPlanTranslation } from '../entities/subscription-plan-translation.entity';
import { Language } from '../../auth/enums';

@Injectable()
export class SubscriptionPlansService {
  private readonly logger = new Logger(SubscriptionPlansService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionFeature)
    private readonly featureRepo: Repository<SubscriptionFeature>,
    @InjectRepository(SubscriptionPlanTranslation)
    private readonly translationRepo: Repository<SubscriptionPlanTranslation>,
  ) {}

  /**
   * Get all active subscription plans with caching
   */
  @Cacheable({
    key: (lang: string, onlyActive: boolean) =>
      `subscription_plans:all:${lang || 'en'}:${onlyActive}`,
    ttl: CACHE_TTL.ONE_DAY,
  })
  async getPlans(
    lang: string = 'en',
    onlyActive: boolean = true,
  ): Promise<SubscriptionPlanDto[]> {
    this.logger.log(
      `Fetching subscription plans from DB (lang: ${lang}, onlyActive: ${onlyActive})`,
    );

    const where: FindOptionsWhere<SubscriptionPlan> = {};
    if (onlyActive) {
      where.isActive = true;
    }

    const plans = await this.planRepo.find({
      where,
      relations: ['translations'],
      order: { priceUsd: 'ASC' },
    });

    const mappedPlans = plans.map((plan) =>
      this.mapPlanWithTranslation(plan, lang),
    );

    return plainToInstance(SubscriptionPlanDto, mappedPlans);
  }

  /**
   * Get a single subscription plan by ID with caching
   */
  @Cacheable({
    key: (id: number, lang: string) =>
      `subscription_plans:${id}:${lang || 'en'}`,
    ttl: CACHE_TTL.ONE_DAY,
  })
  async getPlan(id: number, lang: string = 'en'): Promise<SubscriptionPlanDto> {
    this.logger.log(`Fetching plan ${id} from DB (lang: ${lang})`);

    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['translations', 'features', 'features.translations'],
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan ${id} not found`);
    }

    const mappedPlan = this.mapPlanWithTranslation(plan, lang);
    return plainToInstance(SubscriptionPlanDto, mappedPlan);
  }

  /**
   * Get a single subscription plan by ID with all details (Admin)
   */
  async findOne(id: number): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['translations', 'features', 'features.translations'],
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan ${id} not found`);
    }

    return plan;
  }

  /**
   * Create a new subscription plan
   */
  @CacheInvalidate({
    keys: () => [
      `subscription_plans:all:${Language.EN}:true`,
      `subscription_plans:all:${Language.EN}:false`,
      `subscription_plans:all:${Language.VI}:true`,
      `subscription_plans:all:${Language.VI}:false`,
    ],
  })
  async create(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const plan = this.planRepo.create({
      type: dto.type,
      priceUsd: dto.priceUsd,
      durationMonths: dto.durationMonths,
      isActive: dto.isActive ?? true,
    });
    const savedPlan = await this.planRepo.save(plan);

    if (dto.translations && dto.translations.length > 0) {
      const translations = dto.translations.map((t) =>
        this.translationRepo.create({
          planId: savedPlan.id,
          languageCode: t.languageCode,
          name: t.name,
          description: t.description,
        }),
      );
      await this.translationRepo.save(translations);
    }

    const newPlan = await this.planRepo.findOne({
      where: { id: savedPlan.id },
      relations: ['translations', 'features', 'features.translations'],
    });
    if (!newPlan) throw new NotFoundException('Failed to create plan');
    return newPlan;
  }

  /**
   * Update a subscription plan
   */
  @CacheInvalidate({
    keys: (id: number) => [
      `subscription_plans:all:${Language.EN}:true`,
      `subscription_plans:all:${Language.EN}:false`,
      `subscription_plans:all:${Language.VI}:true`,
      `subscription_plans:all:${Language.VI}:false`,
      `subscription_plans:${id}:${Language.EN}`,
      `subscription_plans:${id}:${Language.VI}`,
    ],
  })
  async update(
    id: number,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    if (dto.type) plan.type = dto.type;
    if (dto.priceUsd !== undefined) plan.priceUsd = dto.priceUsd;
    if (dto.durationMonths !== undefined)
      plan.durationMonths = dto.durationMonths;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;

    await this.planRepo.save(plan);

    if (dto.translations) {
      for (const tDto of dto.translations) {
        let translation = plan.translations.find(
          (t) => t.languageCode === tDto.languageCode,
        );

        if (translation) {
          // Update existing
          translation.name = tDto.name || '';
          translation.description = tDto.description || '';
        } else {
          // Create new
          translation = this.translationRepo.create({
            planId: plan.id,
            languageCode: tDto.languageCode,
            name: tDto.name || '',
            description: tDto.description || '',
          });
        }
        await this.translationRepo.save(translation);
      }
    }

    const updatedPlan = await this.planRepo.findOne({
      where: { id },
      relations: ['translations', 'features', 'features.translations'],
    });

    if (!updatedPlan)
      throw new NotFoundException(`Plan ${id} not found after update`);
    return updatedPlan;
  }

  /**
   * Delete a subscription plan
   */
  @CacheInvalidate({
    keys: (id: number) => [
      `subscription_plans:all:${Language.EN}:true`,
      `subscription_plans:all:${Language.EN}:false`,
      `subscription_plans:all:${Language.VI}:true`,
      `subscription_plans:all:${Language.VI}:false`,
      `subscription_plans:${id}:${Language.EN}`,
      `subscription_plans:${id}:${Language.VI}`,
    ],
  })
  async remove(id: number): Promise<void> {
    const result = await this.planRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
  }

  private mapPlanWithTranslation(
    plan: SubscriptionPlan,
    lang: string,
  ): SubscriptionPlanDto {
    // Find translation for requested language, or fallback to 'en', or first available
    const translation =
      plan.translations.find((t) => t.languageCode === lang) ||
      plan.translations.find(
        (t) => t.languageCode === (Language.EN as string),
      ) ||
      plan.translations[0];

    // Map Features
    const mappedFeatures = (plan.features || []).map((feature) => {
      const featureTrans =
        feature.translations?.find((t) => t.languageCode === lang) ||
        feature.translations?.find(
          (t) => t.languageCode === (Language.EN as string),
        ) ||
        feature.translations?.[0];
      return {
        id: feature.id,
        key: feature.key,
        name: featureTrans?.name || feature.key,
        description: featureTrans?.description,
        isActive: feature.isActive,
      };
    });

    return {
      id: plan.id,
      type: plan.type,
      priceUsd: plan.priceUsd,
      durationMonths: plan.durationMonths,
      isActive: plan.isActive,
      name: translation ? translation.name : 'Unknown Plan',
      description: translation
        ? translation.description
        : 'No description available',
      features:
        mappedFeatures.length > 0
          ? mappedFeatures.filter((f) => f.isActive)
          : [],
    };
  }
}

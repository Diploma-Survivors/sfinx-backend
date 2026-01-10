import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { Cacheable } from '../../../common/decorators/cacheable.decorator';
import { SubscriptionPlanDto } from '../dto/subscription-plan.dto';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';

@Injectable()
export class SubscriptionPlansService {
  private readonly logger = new Logger(SubscriptionPlansService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {}

  /**
   * Get all active subscription plans with caching
   */
  @Cacheable({
    key: (lang: string) => `subscription_plans:all:${lang || 'en'}`,
    ttl: 3600, // 1 hour
  })
  async getPlans(lang: string = 'en'): Promise<SubscriptionPlanDto[]> {
    this.logger.log(`Fetching subscription plans from DB (lang: ${lang})`);

    const plans = await this.planRepo.find({
      where: { isActive: true },
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
    ttl: 3600, // 1 hour
  })
  async getPlan(id: number, lang: string = 'en'): Promise<SubscriptionPlanDto> {
    this.logger.log(`Fetching plan ${id} from DB (lang: ${lang})`);

    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan ${id} not found`);
    }

    const mappedPlan = this.mapPlanWithTranslation(plan, lang);
    return plainToInstance(SubscriptionPlanDto, mappedPlan);
  }

  private mapPlanWithTranslation(
    plan: SubscriptionPlan,
    lang: string,
  ): SubscriptionPlanDto {
    // Find translation for requested language, or fallback to 'en', or first available
    const translation =
      plan.translations.find((t) => t.languageCode === lang) ||
      plan.translations.find((t) => t.languageCode === 'en') ||
      plan.translations[0];

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
    };
  }
}

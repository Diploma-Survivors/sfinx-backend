import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_TTL, Cacheable } from '../../../common';
import { Language } from '../../auth/enums';
import { PaymentMethod } from '../entities/payment-method.entity';

export interface PaymentMethodResponseDto {
  id: number;
  method: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
}

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

  @Cacheable({
    key: (lang: string) => `payment_methods:active:${lang || 'en'}`,
    ttl: CACHE_TTL.ONE_MONTH,
  })
  async getActivePaymentMethods(
    lang: string = 'en',
  ): Promise<PaymentMethodResponseDto[]> {
    this.logger.log(`Fetching active payment methods from DB (lang: ${lang})`);

    const methods = await this.paymentMethodRepo.find({
      where: { isActive: true },
      relations: ['translations'],
      order: { id: 'ASC' },
    });

    return methods.map((method) => this.mapWithTranslation(method, lang));
  }

  private mapWithTranslation(
    method: PaymentMethod,
    lang: string,
  ): PaymentMethodResponseDto {
    const translation =
      method.translations?.find((t) => t.languageCode === lang) ||
      method.translations?.find(
        (t) => t.languageCode === (Language.EN as string),
      ) ||
      method.translations?.[0];

    return {
      id: method.id,
      method: method.method,
      name: translation?.name || `Method #${method.id}`,
      description: translation?.description || null,
      iconUrl: method.iconUrl || null,
      isActive: method.isActive,
    };
  }
}

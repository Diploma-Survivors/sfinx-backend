import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_TTL, Cacheable, CacheInvalidate } from '../../../common';
import { Currency } from '../entities/currency.entity';
import { CurrencyTranslation } from '../entities/currency-translation.entity';
import { CreateCurrencyDto } from '../dto/create-currency.dto';
import { UpdateCurrencyDto } from '../dto/update-currency.dto';
import { CurrencyTranslationDto } from '../dto/currency-translation.dto';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    @InjectRepository(Currency)
    private readonly currencyRepo: Repository<Currency>,
    @InjectRepository(CurrencyTranslation)
    private readonly currencyTranslationRepo: Repository<CurrencyTranslation>,
  ) {}

  @Cacheable({
    key: 'currencies:active',
    ttl: CACHE_TTL.ONE_HOUR,
  })
  async getActiveCurrencies(): Promise<Currency[]> {
    this.logger.log('Fetching active currencies from DB');
    return this.currencyRepo.find({
      where: { isActive: true },
      relations: ['translations'],
      order: { code: 'ASC' },
    });
  }

  async findAll(): Promise<Currency[]> {
    return this.currencyRepo.find({
      relations: ['translations'],
      order: { code: 'ASC' },
    });
  }

  async findByCode(code: string): Promise<Currency | null> {
    return this.currencyRepo.findOne({
      where: { code },
      relations: ['translations'],
    });
  }

  @CacheInvalidate({
    keys: () => [
      'currencies:active',
      'subscription_plans:all:en:true',
      'subscription_plans:all:en:false',
      'subscription_plans:all:vi:true',
      'subscription_plans:all:vi:false',
    ],
  })
  async create(dto: CreateCurrencyDto): Promise<Currency> {
    const currency = this.currencyRepo.create({
      code: dto.code.toUpperCase(),
      name: dto.name,
      symbol: dto.symbol,
      rateToVnd: dto.rateToVnd,
      isActive: dto.isActive ?? true,
    });

    const savedCurrency = await this.currencyRepo.save(currency);

    const translationsToSave: CurrencyTranslationDto[] =
      dto.translations && dto.translations.length > 0
        ? dto.translations
        : [
            {
              languageCode: 'en',
              name: dto.name,
              symbol: dto.symbol,
            },
          ];

    await this.currencyTranslationRepo.save(
      translationsToSave.map((translation) =>
        this.currencyTranslationRepo.create({
          currencyId: savedCurrency.id,
          languageCode: translation.languageCode,
          name: translation.name,
          symbol: translation.symbol,
        }),
      ),
    );

    const created = await this.currencyRepo.findOne({
      where: { id: savedCurrency.id },
      relations: ['translations'],
    });

    if (!created) {
      throw new NotFoundException(
        `Currency with ID ${savedCurrency.id} not found after create`,
      );
    }

    return created;
  }

  @CacheInvalidate({
    keys: () => [
      'currencies:active',
      'subscription_plans:all:en:true',
      'subscription_plans:all:en:false',
      'subscription_plans:all:vi:true',
      'subscription_plans:all:vi:false',
    ],
  })
  async update(id: number, dto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.currencyRepo.findOne({
      where: { id },
      relations: ['translations'],
    });
    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    if (dto.code !== undefined) currency.code = dto.code.toUpperCase();
    if (dto.name !== undefined) currency.name = dto.name;
    if (dto.symbol !== undefined) currency.symbol = dto.symbol;
    if (dto.rateToVnd !== undefined) currency.rateToVnd = dto.rateToVnd;
    if (dto.isActive !== undefined) currency.isActive = dto.isActive;

    await this.currencyRepo.save(currency);

    if (dto.translations) {
      const existingTranslations = currency.translations ?? [];
      for (const tDto of dto.translations) {
        let translation = existingTranslations.find(
          (t) => t.languageCode === tDto.languageCode,
        );

        if (translation) {
          translation.name = tDto.name || '';
          translation.symbol = tDto.symbol || '';
        } else {
          translation = this.currencyTranslationRepo.create({
            currencyId: currency.id,
            languageCode: tDto.languageCode,
            name: tDto.name || '',
            symbol: tDto.symbol || '',
          });
        }

        await this.currencyTranslationRepo.save(translation);
      }
    }

    const updated = await this.currencyRepo.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!updated) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    return updated;
  }

  @CacheInvalidate({
    keys: () => [
      'currencies:active',
      'subscription_plans:all:en:true',
      'subscription_plans:all:en:false',
      'subscription_plans:all:vi:true',
      'subscription_plans:all:vi:false',
    ],
  })
  async remove(id: number): Promise<void> {
    const result = await this.currencyRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }
  }
}

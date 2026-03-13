import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_TTL, Cacheable, CacheInvalidate } from '../../../common';
import { FeeConfig } from '../entities/fee-config.entity';
import { FeeConfigTranslation } from '../entities/fee-config-translation.entity';
import { CreateFeeConfigDto } from '../dto/create-fee-config.dto';
import { UpdateFeeConfigDto } from '../dto/update-fee-config.dto';
import { TranslationDto } from '../dto/translation.dto';

@Injectable()
export class FeeConfigService {
  private readonly logger = new Logger(FeeConfigService.name);

  constructor(
    @InjectRepository(FeeConfig)
    private readonly feeConfigRepo: Repository<FeeConfig>,
    @InjectRepository(FeeConfigTranslation)
    private readonly feeConfigTranslationRepo: Repository<FeeConfigTranslation>,
  ) {}

  @Cacheable({
    key: 'fee_configs:active',
    ttl: CACHE_TTL.ONE_HOUR,
  })
  async getActiveFees(): Promise<FeeConfig[]> {
    this.logger.log('Fetching active fee configs from DB');
    return this.feeConfigRepo.find({
      where: { isActive: true },
      relations: ['translations'],
      order: { code: 'ASC' },
    });
  }

  async findAll(): Promise<FeeConfig[]> {
    return this.feeConfigRepo.find({
      relations: ['translations'],
      order: { code: 'ASC' },
    });
  }

  async getTotalFeePercentage(): Promise<number> {
    const fees = await this.getActiveFees();
    return fees.reduce((sum, fee) => sum + Number(fee.value), 0);
  }

  @CacheInvalidate({
    keys: () => [
      'fee_configs:active',
      'subscription_plans:all:en:true',
      'subscription_plans:all:en:false',
      'subscription_plans:all:vi:true',
      'subscription_plans:all:vi:false',
    ],
  })
  async create(dto: CreateFeeConfigDto): Promise<FeeConfig> {
    const feeConfig = this.feeConfigRepo.create({
      code: dto.code,
      value: dto.value,
      isActive: dto.isActive ?? true,
    });

    const savedFeeConfig = await this.feeConfigRepo.save(feeConfig);

    const translationsToSave: TranslationDto[] =
      dto.translations && dto.translations.length > 0
        ? dto.translations
        : [
            {
              languageCode: 'en',
              name: dto.code,
              description: undefined,
            },
          ];

    await this.feeConfigTranslationRepo.save(
      translationsToSave.map((translation) =>
        this.feeConfigTranslationRepo.create({
          feeConfigId: savedFeeConfig.id,
          languageCode: translation.languageCode,
          name: translation.name,
          description: translation.description,
        }),
      ),
    );

    const created = await this.feeConfigRepo.findOne({
      where: { id: savedFeeConfig.id },
      relations: ['translations'],
    });

    if (!created) {
      throw new NotFoundException(
        `Fee config with ID ${savedFeeConfig.id} not found after create`,
      );
    }

    return created;
  }

  @CacheInvalidate({
    keys: () => [
      'fee_configs:active',
      'subscription_plans:all:en:true',
      'subscription_plans:all:en:false',
      'subscription_plans:all:vi:true',
      'subscription_plans:all:vi:false',
    ],
  })
  async update(id: number, dto: UpdateFeeConfigDto): Promise<FeeConfig> {
    const feeConfig = await this.feeConfigRepo.findOne({
      where: { id },
      relations: ['translations'],
    });
    if (!feeConfig) {
      throw new NotFoundException(`Fee config with ID ${id} not found`);
    }

    if (dto.code !== undefined) feeConfig.code = dto.code;
    if (dto.value !== undefined) feeConfig.value = dto.value;
    if (dto.isActive !== undefined) feeConfig.isActive = dto.isActive;

    await this.feeConfigRepo.save(feeConfig);

    if (dto.translations) {
      const existingTranslations = feeConfig.translations ?? [];
      for (const tDto of dto.translations) {
        let translation = existingTranslations.find(
          (t) => t.languageCode === tDto.languageCode,
        );

        if (translation) {
          translation.name = tDto.name || '';
          translation.description = tDto.description || '';
        } else {
          translation = this.feeConfigTranslationRepo.create({
            feeConfigId: feeConfig.id,
            languageCode: tDto.languageCode,
            name: tDto.name || '',
            description: tDto.description || '',
          });
        }

        await this.feeConfigTranslationRepo.save(translation);
      }
    }

    const updated = await this.feeConfigRepo.findOne({
      where: { id },
      relations: ['translations'],
    });

    if (!updated) {
      throw new NotFoundException(`Fee config with ID ${id} not found`);
    }

    return updated;
  }

  @CacheInvalidate({
    keys: () => [
      'fee_configs:active',
      'subscription_plans:all:en:true',
      'subscription_plans:all:en:false',
      'subscription_plans:all:vi:true',
      'subscription_plans:all:vi:false',
    ],
  })
  async remove(id: number): Promise<void> {
    const result = await this.feeConfigRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Fee config with ID ${id} not found`);
    }
  }
}

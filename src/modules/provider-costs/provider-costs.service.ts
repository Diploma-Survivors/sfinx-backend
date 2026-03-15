import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyService } from '../payments/services/currency.service';
import { QueryProviderCostsDto } from './dto/query-provider-costs.dto';
import { ProviderCostRecord } from './entities/provider-cost-record.entity';
import { UsageProvider } from './interfaces/usage-provider.interface';

export const USAGE_PROVIDERS = 'USAGE_PROVIDERS';

function startOfDayUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function endOfDayUtc(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

@Injectable()
export class ProviderCostsService {
  private readonly logger = new Logger(ProviderCostsService.name);

  constructor(
    @InjectRepository(ProviderCostRecord)
    private readonly recordRepo: Repository<ProviderCostRecord>,
    @Inject(USAGE_PROVIDERS)
    private readonly providers: UsageProvider[],
    private readonly currencyService: CurrencyService,
  ) {}

  async fetchAndStoreForDate(date: Date): Promise<void> {
    const from = startOfDayUtc(date);
    const to = endOfDayUtc(date);

    await Promise.allSettled(
      this.providers.map(async (provider) => {
        try {
          const data = await provider.fetchUsage(from, to);
          await this.recordRepo.upsert(
            {
              provider: data.provider,
              periodStart: data.periodStart,
              periodEnd: data.periodEnd,
              rawMetrics: data.rawMetrics,
              computedCostUsd: data.computedCostUsd,
            },
            { conflictPaths: ['provider', 'periodStart', 'periodEnd'] },
          );
          this.logger.log(
            `[${provider.providerName}] stored $${data.computedCostUsd.toFixed(6)} for ${from.toISOString().slice(0, 10)}`,
          );
        } catch (err) {
          this.logger.error(
            `[${provider.providerName}] fetch failed: ${(err as Error).message}`,
            (err as Error).stack,
          );
        }
      }),
    );
  }

  async getRecords(dto: QueryProviderCostsDto): Promise<{
    data: object[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { provider, from, to, page = 1, limit = 20, currency = 'USD' } = dto;

    const qb = this.recordRepo
      .createQueryBuilder('r')
      .orderBy('r.periodStart', 'DESC');

    if (provider) qb.andWhere('r.provider = :provider', { provider });
    if (from) qb.andWhere('r.periodStart >= :from', { from: new Date(from) });
    if (to)
      qb.andWhere('r.periodStart <= :to', {
        to: new Date(to + 'T23:59:59.999Z'),
      });

    const [records, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await Promise.all(
      records.map(async (r) => ({
        id: r.id,
        provider: r.provider,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        rawMetrics: r.rawMetrics,
        fetchedAt: r.fetchedAt,
        currency,
        computedCost: await this.convertUsd(
          Number(r.computedCostUsd),
          currency,
        ),
        computedCostUsd: Number(r.computedCostUsd),
      })),
    );

    return { data, total, page, limit };
  }

  async getSummary(from: string, to: string, currency: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');

    const rows: Array<{ provider: string; total_usd: string }> =
      await this.recordRepo
        .createQueryBuilder('r')
        .select('r.provider', 'provider')
        .addSelect('SUM(r.computedCostUsd)', 'total_usd')
        .where('r.periodStart >= :from', { from: fromDate })
        .andWhere('r.periodStart <= :to', { to: toDate })
        .groupBy('r.provider')
        .getRawMany();

    const byProviderUsd: Record<string, number> = {};
    let totalUsd = 0;
    for (const row of rows) {
      const amt = Number(row.total_usd);
      byProviderUsd[row.provider] = amt;
      totalUsd += amt;
    }

    const [totalCost, byProvider] = await Promise.all([
      this.convertUsd(totalUsd, currency),
      (async () => {
        const result: Record<string, { cost: number; costUsd: number }> = {};
        for (const [p, usd] of Object.entries(byProviderUsd)) {
          result[p] = {
            cost: await this.convertUsd(usd, currency),
            costUsd: usd,
          };
        }
        return result;
      })(),
    ]);

    return {
      currency,
      totalCost,
      totalCostUsd: totalUsd,
      byProvider,
      periodStart: from,
      periodEnd: to,
    };
  }

  private async convertUsd(
    usdAmount: number,
    targetCode: string,
  ): Promise<number> {
    if (targetCode === 'USD') return usdAmount;

    const [usd, target] = await Promise.all([
      this.currencyService.findByCode('USD'),
      this.currencyService.findByCode(targetCode),
    ]);

    if (!usd || !target) {
      throw new NotFoundException(`Currency '${targetCode}' not found`);
    }

    const inVnd = usdAmount * Number(usd.rateToVnd);
    return Math.round((inVnd / Number(target.rateToVnd)) * 100) / 100;
  }
}

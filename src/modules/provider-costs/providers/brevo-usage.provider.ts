import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios from 'axios';
import { providerCostsConfig } from 'src/config/provider-costs.config';
import { SystemConfigService } from '../../system-config/system-config.service';
import {
  ProviderUsageData,
  UsageProvider,
} from '../interfaces/usage-provider.interface';

function daysInMonth(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

@Injectable()
export class BrevoUsageProvider implements UsageProvider {
  readonly providerName = 'brevo';
  private readonly logger = new Logger(BrevoUsageProvider.name);

  constructor(
    @Inject(providerCostsConfig.KEY)
    private readonly config: ConfigType<typeof providerCostsConfig>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async fetchUsage(from: Date, to: Date): Promise<ProviderUsageData> {
    const { apiKey, apiUrl } = this.config.brevo;
    if (!apiKey) {
      throw new Error('Brevo API key not configured');
    }

    const startDate = from.toISOString().slice(0, 10);
    const endDate = to.toISOString().slice(0, 10);

    interface BrevoAggregatedReport {
      requests?: number;
      delivered?: number;
      hardBounces?: number;
      softBounces?: number;
      spam?: number;
    }

    const { data } = await axios.get<BrevoAggregatedReport>(
      `${apiUrl}/smtp/statistics/aggregatedReport`,
      {
        headers: { 'api-key': apiKey },
        params: { startDate, endDate },
      },
    );

    const emailsSent: number = data.requests ?? 0;
    const delivered: number = data.delivered ?? 0;
    const bounced: number = (data.hardBounces ?? 0) + (data.softBounces ?? 0);
    const spam: number = data.spam ?? 0;

    // Flat monthly plan — allocate pro-rated cost per day
    const monthlyPlanCostUsd = this.systemConfig.getFloat(
      'BREVO_MONTHLY_PLAN_COST_USD',
      25.0,
    );
    const computedCostUsd = monthlyPlanCostUsd / daysInMonth(from);

    this.logger.debug(
      `Brevo: ${emailsSent} sent, ${delivered} delivered, daily cost $${computedCostUsd.toFixed(6)}`,
    );

    return {
      provider: this.providerName,
      periodStart: from,
      periodEnd: to,
      rawMetrics: { emailsSent, delivered, bounced, spam },
      computedCostUsd,
    };
  }
}

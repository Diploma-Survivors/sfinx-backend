import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Client } from 'langsmith';
import { providerCostsConfig } from 'src/config/provider-costs.config';
import { SystemConfigService } from '../../system-config/system-config.service';
import {
  ProviderUsageData,
  UsageProvider,
} from '../interfaces/usage-provider.interface';

@Injectable()
export class LangSmithUsageProvider implements UsageProvider {
  readonly providerName = 'langsmith';
  private readonly logger = new Logger(LangSmithUsageProvider.name);

  constructor(
    @Inject(providerCostsConfig.KEY)
    private readonly config: ConfigType<typeof providerCostsConfig>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async fetchUsage(from: Date, to: Date): Promise<ProviderUsageData> {
    const { apiKey, endpoint, project } = this.config.langsmith;
    if (!apiKey) {
      throw new Error('LangSmith API key not configured');
    }

    const client = new Client({ apiUrl: endpoint, apiKey });

    let totalCostUsd = 0;
    let traceCount = 0;
    let totalTokens = 0;

    // isRoot: true — one record per trace with aggregated cost, avoids double-counting
    // child llm runs roll their cost up to the root chain run's total_cost
    // startTime is supported directly; endTime is not — use filter for upper bound.
    for await (const run of client.listRuns({
      projectName: project,
      isRoot: true,
      startTime: from,
      filter: `lt(start_time, "${to.toISOString()}")`,
    })) {
      const r = run as typeof run & { total_cost?: number | null };
      const cost = r.total_cost != null ? Number(r.total_cost) : 0;
      totalCostUsd += isNaN(cost) ? 0 : cost;
      totalTokens +=
        ((run.prompt_tokens as number) ?? 0) +
        ((run.completion_tokens as number) ?? 0);
      traceCount++;
    }

    // On top of model costs, apply any per-trace pricing (defaults to $0 on free tier)
    const pricePerKTraces = this.systemConfig.getFloat(
      'LANGSMITH_PRICE_PER_1K_TRACES',
      0,
    );
    const computedCostUsd =
      totalCostUsd + (traceCount / 1000) * pricePerKTraces;

    this.logger.debug(
      `LangSmith: ${traceCount} root traces, $${totalCostUsd.toFixed(6)} total cost`,
    );

    return {
      provider: this.providerName,
      periodStart: from,
      periodEnd: to,
      rawMetrics: { rootTraceCount: traceCount, totalTokens, totalCostUsd },
      computedCostUsd,
    };
  }
}

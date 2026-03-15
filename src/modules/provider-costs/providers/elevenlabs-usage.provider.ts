import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios from 'axios';
import { providerCostsConfig } from 'src/config/provider-costs.config';
import { SystemConfigService } from '../../system-config/system-config.service';
import {
  ProviderUsageData,
  UsageProvider,
} from '../interfaces/usage-provider.interface';

@Injectable()
export class ElevenLabsUsageProvider implements UsageProvider {
  readonly providerName = 'elevenlabs';
  private readonly logger = new Logger(ElevenLabsUsageProvider.name);

  constructor(
    @Inject(providerCostsConfig.KEY)
    private readonly config: ConfigType<typeof providerCostsConfig>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async fetchUsage(from: Date, to: Date): Promise<ProviderUsageData> {
    const { apiKey, apiUrl } = this.config.elevenlabs;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    interface ElevenLabsCharStats {
      usage?: number[] | Record<string, number[]>;
    }
    interface ElevenLabsSubscription {
      next_invoice?: { amount_due_cents?: number } | null;
    }

    const headers = { 'xi-api-key': apiKey };
    const [charStatsRes, subscriptionRes] = await Promise.all([
      axios.get<ElevenLabsCharStats>(`${apiUrl}/usage/character-stats`, {
        headers,
        // No include_workspace_metrics — that changes usage to a keyed object
        params: {
          start_unix: Math.floor(from.getTime() / 1000),
          end_unix: Math.floor(to.getTime() / 1000),
        },
      }),
      // Subscription snapshot — non-fatal if unavailable
      axios
        .get<ElevenLabsSubscription>(`${apiUrl}/user/subscription`, { headers })
        .catch(() => ({
          data: { next_invoice: null } as ElevenLabsSubscription,
        })),
    ]);

    const usageRaw: unknown = charStatsRes.data.usage ?? [];
    let totalCharacters = 0;
    if (Array.isArray(usageRaw)) {
      totalCharacters = (usageRaw as number[]).reduce((sum, n) => sum + n, 0);
    } else if (usageRaw && typeof usageRaw === 'object') {
      // Keyed object: { model_id: [count, ...], ... }
      for (const values of Object.values(
        usageRaw as Record<string, number[]>,
      )) {
        if (Array.isArray(values)) {
          totalCharacters += values.reduce(
            (sum: number, n: number) => sum + n,
            0,
          );
        }
      }
    }
    const nextInvoiceCents: number =
      subscriptionRes.data?.next_invoice?.amount_due_cents ?? 0;

    const pricePerKChars = this.systemConfig.getFloat(
      'ELEVEN_PRICE_PER_1K_CHARS',
      0.3,
    );
    const computedCostUsd = (totalCharacters / 1000) * pricePerKChars;

    this.logger.debug(
      `ElevenLabs: ${totalCharacters} characters, $${computedCostUsd.toFixed(6)}`,
    );

    return {
      provider: this.providerName,
      periodStart: from,
      periodEnd: to,
      rawMetrics: { totalCharacters, nextInvoiceCents },
      computedCostUsd,
    };
  }
}

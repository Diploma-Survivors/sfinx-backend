import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios, { AxiosError, type AxiosResponse } from 'axios';
import { providerCostsConfig } from 'src/config/provider-costs.config';
import { SystemConfigService } from '../../system-config/system-config.service';
import {
  ProviderUsageData,
  UsageProvider,
} from '../interfaces/usage-provider.interface';

const PAGE_LIMIT = 100;

@Injectable()
export class DeepgramUsageProvider implements UsageProvider {
  readonly providerName = 'deepgram';
  private readonly logger = new Logger(DeepgramUsageProvider.name);

  constructor(
    @Inject(providerCostsConfig.KEY)
    private readonly config: ConfigType<typeof providerCostsConfig>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async fetchUsage(from: Date, to: Date): Promise<ProviderUsageData> {
    const { apiKey, projectId, apiUrl } = this.config.deepgram;
    if (!apiKey || !projectId) {
      throw new Error('Deepgram API key or project ID not configured');
    }

    let totalCostUsd = 0;
    let totalAudioSeconds = 0;
    let requestCount = 0;
    interface DeepgramRequest {
      response?: {
        details?: {
          usd?: number;
          duration?: number;
        };
      };
    }
    interface DeepgramRequestsResponse {
      requests?: DeepgramRequest[];
    }

    let page = 0;

    while (true) {
      let response: AxiosResponse<DeepgramRequestsResponse>;
      try {
        response = await axios.get<DeepgramRequestsResponse>(
          `${apiUrl}/projects/${projectId}/requests`,
          {
            headers: { Authorization: `Token ${apiKey}` },
            params: {
              start: from.toISOString(),
              end: to.toISOString(),
              limit: PAGE_LIMIT,
              page,
            },
          },
        );
      } catch (err) {
        const status = (err as AxiosError).response?.status;
        if (status === 403) {
          throw new Error(
            'Deepgram API key lacks project management scope. Create a key with "member" role or higher in the Deepgram dashboard.',
          );
        }
        throw err;
      }
      const { data } = response;

      const requests: DeepgramRequest[] = data.requests ?? [];
      for (const req of requests) {
        const details = req.response?.details;

        totalCostUsd += details?.usd ?? 0;
        totalAudioSeconds += details?.duration ?? 0;
        requestCount++;
      }

      if (requests.length < PAGE_LIMIT) break;
      page++;
    }

    this.logger.debug(
      `Deepgram: ${requestCount} requests, ${totalAudioSeconds.toFixed(1)}s audio, $${totalCostUsd.toFixed(6)}`,
    );

    return {
      provider: this.providerName,
      periodStart: from,
      periodEnd: to,
      rawMetrics: { requestCount, totalAudioSeconds, totalCostUsd },
      computedCostUsd: totalCostUsd,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Cacheable } from '../../../common/decorators/cacheable.decorator';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly baseCurrency = 'USD';
  private readonly targetCurrency = 'VND';

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.getOrThrow<string>(
      'payment.exchangeRateApiUrl',
    );
    this.apiKey = this.configService.getOrThrow<string>(
      'payment.exchangeRateApiKey',
    );
  }

  /**
   * Get current exchange rate (USD to VND)
   * Cached for 12 hours (43200 seconds)
   */
  @Cacheable({
    key: 'exchange_rate:usd_vnd',
    ttl: 43200,
  })
  async getExchangeRate(): Promise<number> {
    this.logger.log('Fetching exchange rate from external API...');
    try {
      const response = await axios.get(
        `${this.apiUrl}/${this.apiKey}/latest/${this.baseCurrency}`,
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data: any = response.data;

      if (
        data &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        data.conversion_rates &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        data.conversion_rates[this.targetCurrency]
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const rate = data.conversion_rates[this.targetCurrency] as number;
        this.logger.log(
          `Fetched rate: 1 ${this.baseCurrency} = ${rate} ${this.targetCurrency}`,
        );
        return rate;
      }

      throw new Error('Invalid response format from Exchange Rate API');
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`Failed to fetch exchange rate: ${error.message}`);
      // Fallback to a safe default if API fails (e.g., 25,000 VND)
      // ideally we should throw or monitor this, but for continuity:
      return 25000;
    }
  }

  /**
   * Convert amount from USD to VND
   */
  async convertUsdToVnd(amountUsd: number): Promise<number> {
    const rate = await this.getExchangeRate();
    return Math.floor(amountUsd * rate);
  }
}

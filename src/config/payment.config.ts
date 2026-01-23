import { registerAs } from '@nestjs/config';

export interface PaymentConfig {
  exchangeRateApiUrl: string;
  exchangeRateApiKey: string;
  cronSchedule: string;
  cronEnabled: boolean;
  warningDaysBefore: number;
  batchSize: number;
  renewUrlPath: string;
}

export const paymentConfig = registerAs(
  'payment',
  (): PaymentConfig => ({
    exchangeRateApiUrl:
      process.env.EXCHANGE_RATE_API_URL || 'https://v6.exchangerate-api.com/v6',
    exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY || '',
    cronSchedule: process.env.PAYMENT_CRON_SCHEDULE || '0 0 * * *',
    cronEnabled: process.env.PAYMENT_CRON_ENABLED === 'true',
    warningDaysBefore: parseInt(
      process.env.PAYMENT_WARNING_DAYS_BEFORE || '3',
      10,
    ),
    batchSize: parseInt(process.env.PAYMENT_BATCH_SIZE || '100', 10),
    renewUrlPath: process.env.PAYMENT_RENEW_PATH || '/pricing',
  }),
);

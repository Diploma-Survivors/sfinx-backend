import { registerAs } from '@nestjs/config';

export interface PaymentConfig {
  exchangeRateApiUrl: string;
  exchangeRateApiKey: string;
  cronSchedule: string;
  cronEnabled: boolean;
}

export const paymentConfig = registerAs(
  'payment',
  (): PaymentConfig => ({
    exchangeRateApiUrl:
      process.env.EXCHANGE_RATE_API_URL || 'https://v6.exchangerate-api.com/v6',
    exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY || '',
    cronSchedule: process.env.PAYMENT_CRON_SCHEDULE || '0 0 * * *',
    cronEnabled: process.env.PAYMENT_CRON_ENABLED === 'true',
  }),
);

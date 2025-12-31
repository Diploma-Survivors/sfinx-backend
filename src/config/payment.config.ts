import { registerAs } from '@nestjs/config';

export const PAYMENT_CRON_SCHEDULE =
  process.env.PAYMENT_CRON_SCHEDULE || '0 0 * * *';

export interface PaymentConfig {
  exchangeRateApiUrl: string;
  exchangeRateApiKey: string;
  cronSchedule: string;
}

export const paymentConfig = registerAs(
  'payment',
  (): PaymentConfig => ({
    exchangeRateApiUrl:
      process.env.EXCHANGE_RATE_API_URL || 'https://v6.exchangerate-api.com/v6',
    exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY || '',
    cronSchedule: PAYMENT_CRON_SCHEDULE,
  }),
);

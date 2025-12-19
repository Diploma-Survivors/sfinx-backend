import { registerAs } from '@nestjs/config';

export interface VnpayConfig {
  tmnCode: string;
  secretKey: string;
  url: string;
  returnUrl: string;
  ipnUrl: string;
}

export const vnpayConfig = registerAs(
  'vnpay',
  (): VnpayConfig => ({
    tmnCode: process.env.VNPAY_TMN_CODE!,
    secretKey: process.env.VNPAY_HASH_SECRET!,
    url: process.env.VNPAY_URL!,
    returnUrl: process.env.VNPAY_RETURN_URL!,
    ipnUrl: process.env.VNPAY_IPN_URL!,
  }),
);

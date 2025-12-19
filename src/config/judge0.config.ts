import { registerAs } from '@nestjs/config';

export interface Judge0Config {
  judge0Url: string;
  judge0CallbackUrl: string;
  apiRapidKey: string;
  apiRapidHost: string;
  judge0UseCe: boolean;
}

export const judge0Config = registerAs(
  'judge0',
  (): Judge0Config => ({
    judge0Url: process.env.JUDGE0_URL!,
    judge0CallbackUrl: process.env.JUDGE0_CALLBACK_URL!,
    apiRapidKey: process.env.RAPIDAPI_KEY!,
    apiRapidHost: process.env.RAPIDAPI_HOST!,
    judge0UseCe: process.env.JUDGE0_USE_CE === 'true',
  }),
);

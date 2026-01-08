import { registerAs } from '@nestjs/config';

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export const livekitConfig = registerAs(
  'livekit',
  (): LiveKitConfig => ({
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  }),
);

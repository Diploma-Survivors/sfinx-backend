import { registerAs } from '@nestjs/config';

export interface ProviderCostsConfig {
  cron: {
    schedule: string;
  };
  deepgram: {
    apiKey: string;
    projectId: string;
    apiUrl: string;
  };
  elevenlabs: {
    apiKey: string;
    apiUrl: string;
  };
  langsmith: {
    apiKey: string;
    endpoint: string;
    project: string;
  };
  brevo: {
    apiKey: string;
    apiUrl: string;
  };
}

export const providerCostsConfig = registerAs(
  'providerCosts',
  (): ProviderCostsConfig => ({
    cron: {
      schedule: process.env.PROVIDER_COSTS_CRON_SCHEDULE || '5 0 * * *', // 00:05 UTC daily
    },
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY || '',
      projectId: process.env.DEEPGRAM_PROJECT_ID || '',
      apiUrl: process.env.DEEPGRAM_API_URL || 'https://api.deepgram.com/v1',
    },
    elevenlabs: {
      apiKey: process.env.ELEVEN_API_KEY || '',
      apiUrl: process.env.ELEVEN_API_URL || 'https://api.elevenlabs.io/v1',
    },
    langsmith: {
      apiKey: process.env.LANGSMITH_API_KEY || '',
      endpoint:
        process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com',
      project: process.env.LANGSMITH_PROJECT || 'sfinx-ai-interviews',
    },
    brevo: {
      apiKey: process.env.BREVO_API_KEY || '',
      apiUrl: process.env.BREVO_API_URL || 'https://api.brevo.com/v3',
    },
  }),
);

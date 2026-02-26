import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Langfuse from 'langfuse';

export interface FetchedPrompt {
  template: string;
  version: number;
}

@Injectable()
export class LangfuseService implements OnModuleInit {
  private readonly logger = new Logger(LangfuseService.name);
  private client: Langfuse | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('LANGFUSE_PUBLIC_KEY');
    const secretKey = this.configService.get<string>('LANGFUSE_SECRET_KEY');
    const baseUrl =
      this.configService.get<string>('LANGFUSE_BASE_URL') ||
      'https://cloud.langfuse.com';

    if (!publicKey || !secretKey) {
      this.logger.warn(
        'LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY not set — prompt management from Langfuse is disabled.',
      );
      return;
    }

    this.client = new Langfuse({ publicKey, secretKey, baseUrl });
    this.logger.log('Langfuse client initialized');
  }

  async fetchPrompt(
    name: string,
    label = 'production',
  ): Promise<FetchedPrompt | null> {
    if (!this.client) return null;

    try {
      const prompt = await this.client.getPrompt(name, undefined, {
        label,
        cacheTtlSeconds: 0, // we handle caching ourselves
      });
      return {
        template: prompt.prompt,
        version: prompt.version,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch prompt "${name}" (label: ${label}):`,
        error,
      );
      return null;
    }
  }
}

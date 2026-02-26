import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LangfuseService } from './langfuse.service';
import { PromptCacheService } from './prompt-cache.service';
import { PromptConfigService } from './prompt-config.service';

// Convenience enum — values must match featureName rows seeded in prompt_configs.
export enum PromptFeature {
  INTERVIEWER = 'interviewer',
  EVALUATOR = 'evaluator',
}

export interface PromptStatus {
  id: number;
  featureName: string;
  description: string | null;
  langfusePromptName: string;
  langfuseLabel: string;
  isActive: boolean;
  cached: boolean;
  cachedVersion: number | null;
  lastSyncedAt: string | null;
  langfuseUrl: string | null;
}

@Injectable()
export class PromptService implements OnModuleInit {
  private readonly logger = new Logger(PromptService.name);

  constructor(
    private readonly langfuseService: LangfuseService,
    private readonly promptCacheService: PromptCacheService,
    private readonly promptConfigService: PromptConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Warming prompt cache on startup...');
    const configs = await this.promptConfigService.findAll();
    await Promise.allSettled(
      configs
        .filter((c) => c.isActive)
        .map((c) =>
          this.warmCacheForConfig(
            c.featureName,
            c.langfusePromptName,
            c.langfuseLabel,
          ),
        ),
    );
  }

  async getCompiledPrompt(
    featureName: string,
    variables: Record<string, string>,
  ): Promise<string> {
    const template = await this.getTemplate(featureName);
    return this.compile(template, variables);
  }

  async getStatus(): Promise<PromptStatus[]> {
    const configs = await this.promptConfigService.findAll();
    return Promise.all(
      configs.map(async (config) => {
        const cached = await this.promptCacheService.get(
          config.langfusePromptName,
          config.langfuseLabel,
        );
        return {
          id: config.id,
          featureName: config.featureName,
          description: config.description,
          langfusePromptName: config.langfusePromptName,
          langfuseLabel: config.langfuseLabel,
          isActive: config.isActive,
          cached: !!cached,
          cachedVersion: cached?.version ?? null,
          lastSyncedAt: cached?.fetchedAt ?? null,
          langfuseUrl: this.promptConfigService.buildLangfuseUrl(
            config.langfusePromptName,
          ),
        };
      }),
    );
  }

  async invalidateCache(featureName?: string): Promise<void> {
    if (featureName) {
      const config = await this.promptConfigService.findByFeature(featureName);
      if (!config) {
        throw new NotFoundException(
          `No active prompt config for feature "${featureName}"`,
        );
      }
      await this.promptCacheService.invalidate(
        config.langfusePromptName,
        config.langfuseLabel,
      );
    } else {
      await this.promptCacheService.invalidateAll();
    }
  }

  private async getTemplate(featureName: string): Promise<string> {
    const config = await this.promptConfigService.findByFeature(featureName);
    if (!config) {
      throw new NotFoundException(
        `No active prompt config found for feature "${featureName}"`,
      );
    }

    // 1. Try Redis cache
    const cached = await this.promptCacheService.get(
      config.langfusePromptName,
      config.langfuseLabel,
    );
    if (cached?.template) {
      return cached.template;
    }

    // 2. Fetch from Langfuse
    const fetched = await this.langfuseService.fetchPrompt(
      config.langfusePromptName,
      config.langfuseLabel,
    );
    if (fetched?.template) {
      await this.promptCacheService.set(
        config.langfusePromptName,
        config.langfuseLabel,
        {
          template: fetched.template,
          version: fetched.version,
          fetchedAt: new Date().toISOString(),
        },
      );
      return fetched.template;
    }

    // 3. Both unavailable
    throw new ServiceUnavailableException(
      `Prompt "${featureName}" is unavailable — Redis and Langfuse are both unreachable.`,
    );
  }

  // Replace {{variable}} placeholders (Langfuse template syntax)
  private compile(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
      (acc, [key, val]) =>
        acc.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val),
      template,
    );
  }

  private async warmCacheForConfig(
    featureName: string,
    langfusePromptName: string,
    langfuseLabel: string,
  ): Promise<void> {
    try {
      const existing = await this.promptCacheService.get(
        langfusePromptName,
        langfuseLabel,
      );
      if (existing) {
        this.logger.log(`Prompt cache already warm for "${featureName}"`);
        return;
      }

      const fetched = await this.langfuseService.fetchPrompt(
        langfusePromptName,
        langfuseLabel,
      );
      if (fetched) {
        await this.promptCacheService.set(langfusePromptName, langfuseLabel, {
          template: fetched.template,
          version: fetched.version,
          fetchedAt: new Date().toISOString(),
        });
        this.logger.log(`Cached prompt "${featureName}" (v${fetched.version})`);
      } else {
        this.logger.warn(
          `Could not prefetch prompt "${featureName}" — Langfuse unavailable`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to warm cache for "${featureName}":`, error);
    }
  }
}

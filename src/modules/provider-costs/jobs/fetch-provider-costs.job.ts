import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ProviderCostsService } from '../provider-costs.service';
import { ProviderCostsConfig } from 'src/config/provider-costs.config';

@Injectable()
export class FetchProviderCostsJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(FetchProviderCostsJob.name);

  constructor(
    private readonly providerCostsService: ProviderCostsService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const config =
      this.configService.getOrThrow<ProviderCostsConfig>('providerCosts');
    const cronSchedule = config.cron.schedule;

    const job = new CronJob(
      cronSchedule,
      () => this.handleCron(),
      null,
      true,
      'UTC',
    );

    this.schedulerRegistry.addCronJob('fetch-provider-costs', job);

    this.logger.log(
      `Provider costs fetch job registered with schedule: ${cronSchedule}`,
    );
  }

  async handleCron(): Promise<void> {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    this.logger.log(
      `Provider cost fetch started for ${yesterday.toISOString().slice(0, 10)}`,
    );
    await this.providerCostsService.fetchAndStoreForDate(yesterday);
    this.logger.log('Provider cost fetch completed');
  }
}

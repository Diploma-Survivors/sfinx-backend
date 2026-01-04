import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemParameter } from './entities/system-parameter.entity';

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private cache: Map<string, string> = new Map();

  constructor(
    @InjectRepository(SystemParameter)
    private readonly paramRepo: Repository<SystemParameter>,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
    await this.seedDefaults();
  }

  async refreshCache() {
    const params = await this.paramRepo.find();
    this.cache.clear();
    params.forEach((p) => this.cache.set(p.key, p.value));
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  getInt(key: string, defaultValue: number): number {
    const val = this.cache.get(key);
    return val ? parseInt(val, 10) : defaultValue;
  }

  getFloat(key: string, defaultValue: number): number {
    const val = this.cache.get(key);
    return val ? parseFloat(val) : defaultValue;
  }

  private async seedDefaults() {
    const defaults = [
      {
        key: 'PROBLEM_WEIGHT_EASY',
        value: '10',
        description: 'Score weight for Easy problems',
      },
      {
        key: 'PROBLEM_WEIGHT_MEDIUM',
        value: '20',
        description: 'Score weight for Medium problems',
      },
      {
        key: 'PROBLEM_WEIGHT_HARD',
        value: '30',
        description: 'Score weight for Hard problems',
      },
      {
        key: 'LEADERBOARD_UPDATE_RETRIES',
        value: '3',
        description: 'Max retries for optimistic locking updates',
      },
      {
        key: 'CONTEST_DECAY_RATE',
        value: '0.5',
        description: 'Score decay rate for contests (0-1)',
      },
    ];

    for (const d of defaults) {
      if (!this.cache.has(d.key)) {
        await this.paramRepo.save(d);
        this.logger.log(`Seeded default config: ${d.key}=${d.value}`);
      }
    }
    await this.refreshCache();
  }
}

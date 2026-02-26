import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePromptConfigDto } from './dto/create-prompt-config.dto';
import { UpdatePromptConfigDto } from './dto/update-prompt-config.dto';
import { PromptConfig } from './entities/prompt-config.entity';

@Injectable()
export class PromptConfigService {
  constructor(
    @InjectRepository(PromptConfig)
    private readonly repo: Repository<PromptConfig>,
    private readonly configService: ConfigService,
  ) {}

  findAll(): Promise<PromptConfig[]> {
    return this.repo.find({ order: { featureName: 'ASC' } });
  }

  async findOne(id: number): Promise<PromptConfig> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Prompt config #${id} not found`);
    }
    return config;
  }

  findByFeature(featureName: string): Promise<PromptConfig | null> {
    return this.repo.findOne({ where: { featureName, isActive: true } });
  }

  async create(dto: CreatePromptConfigDto): Promise<PromptConfig> {
    const existing = await this.repo.findOne({
      where: { featureName: dto.featureName },
    });
    if (existing) {
      throw new ConflictException(
        `Prompt config with featureName "${dto.featureName}" already exists`,
      );
    }
    const config = this.repo.create({
      ...dto,
      langfuseLabel: dto.langfuseLabel ?? 'production',
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(config);
  }

  async update(id: number, dto: UpdatePromptConfigDto): Promise<PromptConfig> {
    const config = await this.findOne(id);
    if (dto.featureName && dto.featureName !== config.featureName) {
      const conflict = await this.repo.findOne({
        where: { featureName: dto.featureName },
      });
      if (conflict) {
        throw new ConflictException(
          `Prompt config with featureName "${dto.featureName}" already exists`,
        );
      }
    }
    Object.assign(config, dto);
    return this.repo.save(config);
  }

  async remove(id: number): Promise<void> {
    const config = await this.findOne(id);
    config.isActive = false;
    await this.repo.save(config);
  }

  buildLangfuseUrl(langfusePromptName: string): string | null {
    const baseUrl = this.configService.get<string>('LANGFUSE_BASE_URL');
    const projectId = this.configService.get<string>('LANGFUSE_PROJECT_ID');
    if (!baseUrl || !projectId) return null;
    return `${baseUrl}/project/${projectId}/prompts/${langfusePromptName}`;
  }
}

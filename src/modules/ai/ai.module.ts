import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LangChainService } from './langchain.service';
import { LangfuseService } from './langfuse.service';
import { PromptCacheService } from './prompt-cache.service';
import { PromptConfigService } from './prompt-config.service';
import { PromptService } from './prompt.service';
import { PromptAdminController } from './prompt-admin.controller';
import { PromptConfig } from './entities/prompt-config.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([PromptConfig])],
  controllers: [PromptAdminController],
  providers: [
    LangChainService,
    LangfuseService,
    PromptCacheService,
    PromptConfigService,
    PromptService,
  ],
  exports: [LangChainService, PromptService],
})
export class AiModule {}

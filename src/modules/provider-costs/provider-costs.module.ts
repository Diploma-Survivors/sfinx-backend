import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { providerCostsConfig } from 'src/config/provider-costs.config';
import { PaymentsModule } from '../payments/payments.module';
import { ProviderCostRecord } from './entities/provider-cost-record.entity';
import { FetchProviderCostsJob } from './jobs/fetch-provider-costs.job';
import { ProviderCostsController } from './provider-costs.controller';
import {
  USAGE_PROVIDERS,
  ProviderCostsService,
} from './provider-costs.service';
import { BrevoUsageProvider } from './providers/brevo-usage.provider';
import { DeepgramUsageProvider } from './providers/deepgram-usage.provider';
import { ElevenLabsUsageProvider } from './providers/elevenlabs-usage.provider';
import { LangSmithUsageProvider } from './providers/langsmith-usage.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderCostRecord]),
    ConfigModule.forFeature(providerCostsConfig),
    PaymentsModule,
  ],
  controllers: [ProviderCostsController],
  providers: [
    ProviderCostsService,
    FetchProviderCostsJob,
    LangSmithUsageProvider,
    DeepgramUsageProvider,
    ElevenLabsUsageProvider,
    BrevoUsageProvider,
    {
      provide: USAGE_PROVIDERS,
      useFactory: (
        langsmith: LangSmithUsageProvider,
        deepgram: DeepgramUsageProvider,
        elevenlabs: ElevenLabsUsageProvider,
        brevo: BrevoUsageProvider,
      ) => [langsmith, deepgram, elevenlabs, brevo],
      inject: [
        LangSmithUsageProvider,
        DeepgramUsageProvider,
        ElevenLabsUsageProvider,
        BrevoUsageProvider,
      ],
    },
  ],
})
export class ProviderCostsModule {}

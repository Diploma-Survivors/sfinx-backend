import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { PaymentsController } from './controllers/payments.controller';
import { SubscriptionPlansController } from './controllers/subscription-plans.controller';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { SubscriptionPlanTranslation } from './entities/subscription-plan-translation.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { VnPayProvider } from './providers/vnpay.provider';
import { ExchangeRateService } from './services/exchange-rate.service';
import { PaymentSubscriptionService } from './services/payment-subscription.service';
import { PaymentsService } from './services/payments.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { MailService, TemplateService } from '../mail';

import { SubscriptionFeature } from './entities/subscription-feature.entity';
import { SubscriptionFeatureTranslation } from './entities/subscription-feature-translation.entity';
import { SubscriptionFeatureService } from './services/subscription-feature.service';
import { SubscriptionFeaturesController } from './controllers/subscription-features.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      SubscriptionPlan,
      SubscriptionPlanTranslation,
      SubscriptionFeature,
      SubscriptionFeatureTranslation,
      User,
    ]),
    ConfigModule,
  ],
  controllers: [
    PaymentsController,
    SubscriptionPlansController,
    SubscriptionFeaturesController,
  ],
  providers: [
    PaymentsService,
    ExchangeRateService,
    VnPayProvider,
    PaymentSubscriptionService,
    SubscriptionPlansService,
    SubscriptionFeatureService,
    MailService,
    TemplateService,
  ],

  exports: [PaymentsService],
})
export class PaymentsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { MailModule } from '../mail';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './controllers/payments.controller';
import { SubscriptionFeaturesController } from './controllers/subscription-features.controller';
import { SubscriptionPlansController } from './controllers/subscription-plans.controller';
import { PaymentMethodTranslation } from './entities/payment-method-translation.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { SubscriptionFeatureTranslation } from './entities/subscription-feature-translation.entity';
import { SubscriptionFeature } from './entities/subscription-feature.entity';
import { SubscriptionPlanTranslation } from './entities/subscription-plan-translation.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { VnPayProvider } from './providers/vnpay.provider';
import { ExchangeRateService } from './services/exchange-rate.service';
import { PaymentMethodService } from './services/payment-method.service';
import { PaymentSubscriptionService } from './services/payment-subscription.service';
import { PaymentsService } from './services/payments.service';
import { SubscriptionFeatureService } from './services/subscription-feature.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      PaymentMethod,
      PaymentMethodTranslation,
      SubscriptionPlan,
      SubscriptionPlanTranslation,
      SubscriptionFeature,
      SubscriptionFeatureTranslation,
      User,
    ]),
    ConfigModule,
    NotificationsModule,
    MailModule,
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
    PaymentProviderFactory,
    PaymentMethodService,
    PaymentSubscriptionService,
    SubscriptionPlansService,
    SubscriptionFeatureService,
  ],

  exports: [PaymentsService],
})
export class PaymentsModule {}

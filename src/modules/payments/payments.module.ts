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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      SubscriptionPlan,
      SubscriptionPlanTranslation,
      User,
    ]),
    ConfigModule,
  ],
  controllers: [PaymentsController, SubscriptionPlansController],
  providers: [
    PaymentsService,
    ExchangeRateService,
    VnPayProvider,
    PaymentSubscriptionService,
    SubscriptionPlansService,
  ],

  exports: [PaymentsService],
})
export class PaymentsModule {}

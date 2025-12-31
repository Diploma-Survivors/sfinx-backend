import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Problem } from '../problems/entities/problem.entity';
import { Contest } from '../contest/entities/contest.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { PlatformStatisticsService } from './services/platform-statistics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Problem,
      Contest,
      Submission,
      PaymentTransaction,
    ]),
  ],
  controllers: [AdminDashboardController],
  providers: [PlatformStatisticsService],
  exports: [PlatformStatisticsService],
})
export class AdminModule {}

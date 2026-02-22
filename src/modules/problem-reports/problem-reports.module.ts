import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { ProblemReportsController } from './problem-reports.controller';
import { ProblemReportsService } from './problem-reports.service';
import { ProblemReport } from './entities/problem-report.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProblemReport, User]),
    StorageModule,
    NotificationsModule,
  ],
  controllers: [ProblemReportsController],
  providers: [ProblemReportsService],
})
export class ProblemReportsModule {}

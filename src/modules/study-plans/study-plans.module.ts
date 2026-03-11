import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Problem } from '../problems/entities/problem.entity';
import { Tag } from '../problems/entities/tag.entity';
import { Topic } from '../problems/entities/topic.entity';
import { StorageModule } from '../storage/storage.module';
import { StudyPlanAdminController } from './controllers/study-plan-admin.controller';
import { StudyPlanController } from './controllers/study-plan.controller';
import { StudyPlanEnrollment } from './entities/study-plan-enrollment.entity';
import { StudyPlanItem } from './entities/study-plan-item.entity';
import { StudyPlanTranslation } from './entities/study-plan-translation.entity';
import { StudyPlan } from './entities/study-plan.entity';
import { StudyPlanProgressListener } from './listeners/study-plan-progress.listener';
import { StudyPlanEnrollmentService } from './services/study-plan-enrollment.service';
import { StudyPlanLeaderboardService } from './services/study-plan-leaderboard.service';
import { StudyPlanNotificationService } from './services/study-plan-notification.service';
import { StudyPlanQueryService } from './services/study-plan-query.service';
import { StudyPlanService } from './services/study-plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudyPlan,
      StudyPlanItem,
      StudyPlanEnrollment,
      StudyPlanTranslation,
      Problem,
      Topic,
      Tag,
    ]),
    StorageModule,
    NotificationsModule,
  ],
  controllers: [StudyPlanController, StudyPlanAdminController],
  providers: [
    StudyPlanService,
    StudyPlanQueryService,
    StudyPlanEnrollmentService,
    StudyPlanLeaderboardService,
    StudyPlanNotificationService,
    StudyPlanProgressListener,
  ],
  exports: [StudyPlanService, StudyPlanEnrollmentService],
})
export class StudyPlansModule {}

import { CacheModule } from '@nestjs/cache-manager';
import {
  ClassSerializerInterceptor,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  APP_PIPE,
  Reflector,
} from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import KeyvRedis from '@keyv/redis';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  addTransactionalDataSource,
  getDataSourceByName,
} from 'typeorm-transactional';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter, TransformInterceptor } from './common';
import {
  adminConfig,
  appConfig,
  awsConfig,
  databaseConfig,
  emailConfig,
  environmentValidation,
  googleConfig,
  judge0Config,
  jwtConfig,
  redisConfig,
  submissionConfig,
  vnpayConfig,
} from './config';
import { AuthModule } from './modules/auth/auth.module';
import { Judge0Module } from './modules/judge0/judge0.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ProgrammingLanguageModule } from './modules/programming-language';
import { RbacModule } from './modules/rbac/rbac.module';
import { RedisModule } from './modules/redis/redis.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ContestModule } from './modules/contest/contest.module';
import { UsersModule } from './modules/users/users.module';
import { SolutionsModule } from './modules/solutions/solutions.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        adminConfig,
        appConfig,
        awsConfig,
        databaseConfig,
        emailConfig,
        googleConfig,
        judge0Config,
        jwtConfig,
        redisConfig,
        submissionConfig,
        vnpayConfig,
      ],
      validationSchema: environmentValidation,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow<TypeOrmModuleOptions>('database'),
      dataSourceFactory: async (options: DataSourceOptions) => {
        if (!options) {
          throw new Error('Invalid options passed');
        }

        const existingDataSource = getDataSourceByName('default');
        if (existingDataSource) {
          return existingDataSource;
        }

        const dataSource = await new DataSource(options).initialize();
        return addTransactionalDataSource(dataSource);
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const username = configService.get<string>('redis.username');
        const password = configService.get<string>('redis.password');
        const host = configService.get<string>('redis.host');
        const port = configService.get<number>('redis.port');
        const db = configService.get<number>('redis.db');
        const authPart = username && password ? `${username}:${password}@` : '';
        const redisUrl = `redis://${authPart}${host}:${port}/${db}`;

        return {
          stores: [new KeyvRedis(redisUrl)],
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Core modules
    RedisModule,
    RbacModule,

    // Feature modules
    AuthModule,
    ProblemsModule,
    SubmissionsModule,
    Judge0Module,
    ProgrammingLanguageModule,
    ContestModule,
    UsersModule,
    SolutionsModule,
    // PaymentsModule,
    // AiModule,
    // CommunityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      inject: [Reflector],
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) =>
        new ClassSerializerInterceptor(reflector),
    },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          transform: true,
          whitelist: true,
        }),
    },
  ],
})
export class AppModule {}

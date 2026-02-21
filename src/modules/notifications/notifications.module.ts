import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import { JwtConfig } from '../../config/jwt.config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { privateKey, publicKey, algorithm, accessExpiresInMs } =
          configService.getOrThrow<JwtConfig>('jwt');

        return {
          privateKey,
          publicKey,
          signOptions: {
            expiresIn: `${accessExpiresInMs}ms`,
            algorithm,
          },
          verifyOptions: {
            algorithms: [algorithm],
          },
        } as JwtModuleOptions;
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}

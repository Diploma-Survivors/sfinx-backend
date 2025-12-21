import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailConfig } from '../../config/email.config';
import { MailService } from './mail.service';
import { MailProcessor } from './processors/mail.processor';
import { TemplateService } from './services/template.service';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'mail',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const emailConfig = configService.get<EmailConfig>('email')!;
        const redisHost = configService.get<string>('redis.host')!;
        const redisPort = configService.get<number>('redis.port')!;
        const redisPassword = configService.get<string>('redis.password');
        const redisUsername = configService.get<string>('redis.username');

        return {
          connection: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            username: redisUsername,
          },
          defaultJobOptions: {
            attempts: emailConfig.queue.attempts,
            backoff: emailConfig.queue.backoff,
            removeOnComplete: true,
            removeOnFail: false,
          },
        };
      },
    }),
  ],
  providers: [MailService, TemplateService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}

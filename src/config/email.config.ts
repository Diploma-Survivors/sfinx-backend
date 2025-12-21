import { registerAs } from '@nestjs/config';
import * as path from 'path';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
  templatesDir: string;
  queue: {
    enabled: boolean;
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
  };
}

export const emailConfig = registerAs(
  'email',
  (): EmailConfig => ({
    host: process.env.SMTP_HOST!,
    port: Number.parseInt(process.env.SMTP_PORT!, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
    from: {
      name: process.env.SMTP_FROM_NAME || 'sFinx Platform',
      address: process.env.SMTP_FROM!,
    },
    templatesDir: path.join(__dirname, '..', 'modules', 'mail', 'templates'),
    queue: {
      enabled: process.env.MAIL_QUEUE_ENABLED !== 'false',
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),
);

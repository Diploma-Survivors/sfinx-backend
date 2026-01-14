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
  defaultLayout: string;
  queue: {
    enabled: boolean;
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
  };
}

const TEMPLATE_BASE_PATH = 'modules/mail/templates';
const DEFAULT_TEMPLATE_LAYOUT = 'layouts/base';
const QUEUE_ATTEMPTS = 3;
const QUEUE_BACKOFF_DELAY = 2000;

/**
 * Resolve templates directory based on environment
 * - Dev: src/modules/mail/templates
 * - Prod: dist/src/modules/mail/templates
 */
function resolveTemplatesDir(): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const envPath = isDev ? 'src' : 'dist/src';
  return path.join(process.cwd(), envPath, TEMPLATE_BASE_PATH);
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
    templatesDir: resolveTemplatesDir(),
    defaultLayout: process.env.MAIL_DEFAULT_LAYOUT || DEFAULT_TEMPLATE_LAYOUT,
    queue: {
      enabled: process.env.MAIL_QUEUE_ENABLED !== 'false',
      attempts: QUEUE_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: QUEUE_BACKOFF_DELAY,
      },
    },
  }),
);

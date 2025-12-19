import { registerAs } from '@nestjs/config';
import { Environment } from 'src/common';

export interface AppConfig {
  nodeEnv: string;
  version: string;
  port: number;
  name: string;
  url: string;
  frontendUrl: string;
  corsOrigins: string[];
  bcryptSaltRounds: number;
  cookieSecret: string;
  enableSwagger: boolean;
  swaggerPath: string;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || Environment.DEVELOPMENT,
    version: process.env.API_VERSION || 'v1',
    port: Number.parseInt(process.env.PORT!, 10) || 3000,
    name: process.env.APP_NAME || 'sFinx Backend',
    url: process.env.APP_URL || 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // CORS configuration
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
    ],

    // Security
    bcryptSaltRounds:
      Number.parseInt(process.env.BCRYPT_SALT_ROUNDS!, 10) || 10,
    cookieSecret: process.env.COOKIE_SECRET || 'default-cookie-secret',

    // Swagger
    enableSwagger: process.env.ENABLE_SWAGGER === 'true' || true,
    swaggerPath: process.env.SWAGGER_PATH || '/api/docs',
  }),
);

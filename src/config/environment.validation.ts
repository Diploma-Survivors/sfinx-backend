import Joi from 'joi';
import { Environment } from 'src/common';

export const environmentValidation = Joi.object({
  // App Configuration
  NODE_ENV: Joi.string()
    .valid(Environment.DEVELOPMENT, Environment.PRODUCTION, Environment.TEST)
    .default(Environment.DEVELOPMENT),
  API_VERSION: Joi.string().default('v1'),
  APP_NAME: Joi.string().default('sFinx Backend'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  FRONTEND_URL: Joi.string().default('http://localhost:5173'),

  // Security
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),
  CORS_ORIGINS: Joi.string().required(),
  COOKIE_SECRET: Joi.string().required(),

  // Swagger configuration
  ENABLE_SWAGGER: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('/api/docs'),

  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // JWT configuration
  JWT_PRIVATE_KEY_PATH: Joi.string().required(),
  JWT_PUBLIC_KEY_PATH: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN_MS: Joi.number().default(900000), // 15 minutes in milliseconds
  JWT_REFRESH_EXPIRES_IN_MS: Joi.number().default(604800000), // 7 days in milliseconds
  JWT_ALGORITHM: Joi.string().default('EdDSA'),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().required(),

  // Judge0 Configuration
  JUDGE0_URL: Joi.string().uri().required(),
  JUDGE0_CALLBACK_URL: Joi.string().uri().required(),
  JUDGE0_USE_CE: Joi.boolean().default(true),
  RAPIDAPI_KEY: Joi.string().required(),
  RAPIDAPI_HOST: Joi.string().hostname().required(),

  // Redis Configuration
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(3600), // 1 hour in seconds

  AWS_REGION: Joi.string().required(),
  AWS_S3_REGION: Joi.string().optional(),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_S3_BUCKET: Joi.string().required(),
  AWS_CLOUDFRONT_URL: Joi.string().uri().required(),

  // VnPay Configuration
  VNPAY_TMN_CODE: Joi.string().required(),
  VNPAY_HASH_SECRET: Joi.string().required(),
  VNPAY_URL: Joi.string().uri().required(),
  VNPAY_RETURN_URL: Joi.string().uri().required(),
  VNPAY_IPN_URL: Joi.string().uri().required(),

  // Payment
  EXCHANGE_RATE_API_URL: Joi.string().uri().optional(),
  EXCHANGE_RATE_API_KEY: Joi.string().optional(),
  PAYMENT_CRON_SCHEDULE: Joi.string().default('0 0 * * *'),

  // Email Configuration
  SMTP_HOST: Joi.string().hostname().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  SMTP_FROM: Joi.string().email().required(),
  SMTP_FROM_NAME: Joi.string().required(),
  MAIL_QUEUE_ENABLED: Joi.boolean().default(false),
  MAIL_DEFAULT_LAYOUT: Joi.string().default('layouts/base'),

  // Admin User
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_USERNAME: Joi.string().required(),
  ADMIN_PASSWORD: Joi.string().required(),

  // Submission Configuration
  SUBMISSION_CLEANUP_STREAM_TIME: Joi.number().default(60000), // 1 minute in milliseconds
  SUBMISSION_PING_TIME: Joi.number().default(3000), // 3 seconds in milliseconds
  JOB_ATTEMPTS: Joi.number().default(5),
  JOB_BACKOFF_TYPE: Joi.string()
    .valid('exponential', 'linear')
    .default('exponential'),
  JOB_BACKOFF_DELAY: Joi.number().default(1000), // 1 second in milliseconds
  JOB_REMOVE_ON_COMPLETE: Joi.boolean().default(true),
  JOB_REMOVE_ON_FAIL: Joi.number().default(50), // 50 attempts before removal
  USE_AWS: Joi.boolean().default(false),
});

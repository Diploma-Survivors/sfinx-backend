import { Response } from 'express';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import cookieParser from 'cookie-parser';
import qs, { ParsedQs } from 'qs';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';

import { AppModule } from './app.module';
import { ExpressSetting } from './common';
import { AppConfig } from './config';

async function bootstrap() {
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Query parser configuration
  app.set(
    ExpressSetting.QUERY_PARSER,
    (str: string): ParsedQs =>
      qs.parse(str, { allowPrototypes: false, allowDots: true }),
  );

  // IP address trust configuration
  app.set(ExpressSetting.TRUST_PROXY, true);

  const appConfig = configService.getOrThrow<AppConfig>('app');

  // Global prefix
  const apiVersion = appConfig.version;
  app.setGlobalPrefix(apiVersion);

  // CORS configuration
  // const corsOrigins = appConfig.corsOrigins;
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Cookie parser
  const cookieSecret = appConfig.cookieSecret;
  app.use(cookieParser(cookieSecret));

  // Swagger documentation
  const enableSwagger = appConfig.enableSwagger;
  if (enableSwagger) {
    const swaggerPath = appConfig.swaggerPath;
    const config = new DocumentBuilder()
      .setTitle('sFinx API')
      .setDescription('sFinx Backend API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Problems', 'Problem management endpoints')
      .addTag(
        'Programming Languages',
        'Programming language management endpoints',
      )
      .addTag('Submissions', 'Code submission endpoints')
      .addTag('Contests', 'Contest management endpoints')
      .addTag('Payments', 'Payment and subscription endpoints')
      .addTag('AI', 'AI features endpoints')
      .addTag('Community', 'Community features endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    app
      .getHttpAdapter()
      .get(`/${apiVersion}/swagger-json`, (_req, res: Response) => {
        res.json(document);
      });

    logger.log(`Swagger documentation available at: ${swaggerPath}`);
  }

  // Start server
  const port = appConfig.port;
  await app.listen(port);

  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Environment: ${appConfig.nodeEnv}`);
}

void bootstrap();

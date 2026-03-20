import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const commonOptions = {
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
  logging: process.env.DB_LOGGING === 'true' || false,
  autoLoadEntities: true,
  extra: {
    max: 150,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  },
};

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions =>
    process.env.DATABASE_URL
      ? {
          type: 'postgres' as const,
          url: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          ...commonOptions,
        }
      : {
          type: 'postgres' as const,
          host: process.env.DB_HOST || 'localhost',
          port: Number.parseInt(process.env.DB_PORT!, 10) || 5432,
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'sfinx',
          ...commonOptions,
        },
);

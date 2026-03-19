import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { config } from 'dotenv';
import { join } from 'path';

config();

const baseOptions: Omit<PostgresConnectionOptions, 'type'> = {
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true' || false,
};

export const dataSourceOptions: PostgresConnectionOptions = process.env
  .DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      ...baseOptions,
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number.parseInt(process.env.DB_PORT!, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ...baseOptions,
    };

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;

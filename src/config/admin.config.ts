import { registerAs } from '@nestjs/config';

export interface AdminConfig {
  email: string;
  username: string;
  password: string;
}

export const adminConfig = registerAs(
  'admin',
  (): AdminConfig => ({
    email: process.env.ADMIN_EMAIL!,
    username: process.env.ADMIN_USERNAME!,
    password: process.env.ADMIN_PASSWORD!,
  }),
);

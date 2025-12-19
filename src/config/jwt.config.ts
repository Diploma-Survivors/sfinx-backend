import { registerAs } from '@nestjs/config';

import { Algorithm } from 'jsonwebtoken';

export interface JwtConfig {
  privateKey: string;
  publicKey: string;

  accessExpiresInMs: number;
  refreshExpiresInMs: number;

  algorithm: Algorithm;
}

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    privateKey: process.env.JWT_PRIVATE_KEY!,
    publicKey: process.env.JWT_PUBLIC_KEY!,

    accessExpiresInMs: Number.parseInt(
      process.env.JWT_ACCESS_EXPIRES_IN_MS || '900000',
      10,
    ), // 15 minutes
    refreshExpiresInMs: Number.parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_MS || '604800000',
      10,
    ), // 7 days

    algorithm: (process.env.JWT_ALGORITHM || 'RS256') as Algorithm,
  }),
);

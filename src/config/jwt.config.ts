import { registerAs } from '@nestjs/config';

import { Algorithm } from 'jsonwebtoken';

export interface JwtConfig {
  privateKey: string;
  publicKey: string;

  accessExpiresInMs: number;
  refreshExpiresInMs: number;

  algorithm: Algorithm;
}

export const jwtConfig = registerAs('jwt', (): JwtConfig => {
  // Replace escaped newlines with actual newlines (if using \n format)
  // Also handle actual newlines in multi-line strings
  const privateKey = process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const publicKey = process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, '\n');

  return {
    privateKey,
    publicKey,

    accessExpiresInMs: Number.parseInt(
      process.env.JWT_ACCESS_EXPIRES_IN_MS || '900000',
      10,
    ), // 15 minutes
    refreshExpiresInMs: Number.parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_MS || '604800000',
      10,
    ), // 7 days

    algorithm: (process.env.JWT_ALGORITHM || 'RS256') as Algorithm,
  };
});

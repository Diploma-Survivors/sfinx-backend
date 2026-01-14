import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { Algorithm } from 'jsonwebtoken';

export interface JwtConfig {
  privateKey: string;
  publicKey: string;

  accessExpiresInMs: number;
  refreshExpiresInMs: number;

  algorithm: Algorithm;
}

export const jwtConfig = registerAs('jwt', (): JwtConfig => {
  if (!process.env.JWT_PRIVATE_KEY_PATH || !process.env.JWT_PUBLIC_KEY_PATH) {
    throw new Error('Missing JWT environment variables');
  }

  let privateKey: string;
  let publicKey: string;

  try {
    privateKey = readFileSync(
      resolve(process.env.JWT_PRIVATE_KEY_PATH),
      'utf-8',
    );
    publicKey = readFileSync(resolve(process.env.JWT_PUBLIC_KEY_PATH), 'utf-8');

    if (!privateKey?.trim() || !publicKey?.trim()) {
      throw new Error('Key files are empty');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load JWT keys. Generate them using: npm run generat:keypair. Error: ${errorMessage}`,
    );
  }

  return {
    privateKey,
    publicKey,

    accessExpiresInMs: Number.parseInt(
      process.env.JWT_ACCESS_EXPIRES_IN_MS || '900000',
      10,
    ),
    refreshExpiresInMs: Number.parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_MS || '604800000',
      10,
    ),

    algorithm: (process.env.JWT_ALGORITHM || 'ES256') as Algorithm,
  };
});

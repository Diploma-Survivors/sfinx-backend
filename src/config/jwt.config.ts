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
  const privateKey = loadKey('JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_PATH');
  const publicKey = loadKey('JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_PATH');

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

function loadKey(envVar: string, pathVar: string): string {
  // Prefer inline env var (for Cloud Run / Secret Manager)
  if (process.env[envVar]?.trim()) {
    return process.env[envVar];
  }

  // Fall back to file path (for local development)
  const filePath = process.env[pathVar];
  if (!filePath) {
    throw new Error(
      `Missing JWT key: set ${envVar} (inline) or ${pathVar} (file path)`,
    );
  }

  try {
    const key = readFileSync(resolve(filePath), 'utf-8');
    if (!key?.trim()) {
      throw new Error('Key file is empty');
    }
    return key;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load JWT key from ${pathVar}. Generate keys: npm run generate:keypair. Error: ${msg}`,
    );
  }
}

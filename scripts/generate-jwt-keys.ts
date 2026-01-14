import { generateKeyPairSync } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function generateES256KeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  return { privateKey, publicKey };
}

function main() {
  console.log('🔐 Generating ES256 JWT Key Pair...\n');

  const { privateKey, publicKey } = generateES256KeyPair();

  const secretsDir = join(process.cwd(), 'secrets');

  if (!existsSync(secretsDir)) {
    mkdirSync(secretsDir, { recursive: true });
    console.log(`📁 Created ${secretsDir} directory\n`);
  }

  const privateKeyPath = join(secretsDir, 'jwt.private.pem');
  const publicKeyPath = join(secretsDir, 'jwt.public.pem');

  writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

  console.log('✅ Keys generated successfully!');
  console.log(`📄 Private: ${privateKeyPath}`);
  console.log(`📄 Public:  ${publicKeyPath}\n`);
}

main();

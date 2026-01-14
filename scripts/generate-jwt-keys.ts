import { generateKeyPairSync } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function generateEd25519KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: {
      format: 'pem',
      type: 'pkcs8',
    },
    publicKeyEncoding: {
      format: 'pem',
      type: 'spki',
    },
  });

  return { privateKey, publicKey };
}

function main(): void {
  console.log('🔐 Generating Ed25519 JWT Key Pair...\n');

  const { privateKey, publicKey } = generateEd25519KeyPair();

  // Create secrets directory if it doesn't exist
  const secretsDir: string = join(__dirname, '..', 'secrets');
  if (!existsSync(secretsDir)) {
    mkdirSync(secretsDir, { recursive: true });
    console.log(`📁 Created ${secretsDir} directory\n`);
  }

  const privateKeyPath: string = join(secretsDir, 'jwt.private.pem');
  const publicKeyPath: string = join(secretsDir, 'jwt.public.pem');

  writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

  console.log('✅ Keys generated and saved successfully!\n');
  console.log(`📄 Private Key: ${privateKeyPath}`);
  console.log(`📄 Public Key:  ${publicKeyPath}\n`);
}

main();

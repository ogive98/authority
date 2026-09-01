import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../../.env'),
].find((candidate) => existsSync(candidate));

if (envPath) {
  config({ path: envPath, override: false });
}

process.env.NODE_ENV ??= 'test';
process.env.AUTHORITY_MFA_ENCRYPTION_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

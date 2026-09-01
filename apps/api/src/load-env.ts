import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
    break;
  }
}

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'DATABASE_URL manquante. Copiez .env.example vers .env à la racine du monorepo, puis relancez.',
  );
}

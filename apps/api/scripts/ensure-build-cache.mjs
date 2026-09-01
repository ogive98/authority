import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const tsBuildInfo = resolve(process.cwd(), 'tsconfig.build.tsbuildinfo');
const distTsBuildInfo = resolve(distDir, '.tsbuildinfo');

if (!existsSync(distDir) && existsSync(tsBuildInfo)) {
  rmSync(tsBuildInfo, { force: true });
}

if (!existsSync(distDir) && existsSync(distTsBuildInfo)) {
  rmSync(distTsBuildInfo, { force: true });
}

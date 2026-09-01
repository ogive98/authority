import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function main() {
  const envPath = resolve(process.cwd(), '../../.env');
  if (existsSync(envPath)) {
    config({ path: envPath });
  }

  const port = process.env.API_PORT ?? '3001';

  if (process.platform === 'win32') {
    try {
      const output = execSync(
        `netstat -ano | findstr ":${port}" | findstr LISTENING`,
        { encoding: 'utf8' },
      );
      const pid = output.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
        console.log(`Stopped process ${pid} on port ${port}`);
        return;
      }
    } catch {
      // no listener
    }
  } else {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'inherit' });
      console.log(`Stopped process on port ${port}`);
      return;
    } catch {
      // no listener
    }
  }

  console.log(`No process listening on port ${port}`);
}

main();

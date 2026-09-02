import { execSync } from 'node:child_process';

const port = process.env.WEB_PORT ?? '3000';

function main() {
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

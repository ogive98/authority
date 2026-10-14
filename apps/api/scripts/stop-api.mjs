import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `nest start --watch` spawns the server as a child. Killing only the port
 * listener leaves the watcher alive (~1.3 GB) and it re-spawns a second server
 * on the next file change. Match the watcher by its own command line instead.
 */
function killNestWatchers() {
  if (process.platform !== 'win32') return;
  try {
    // No nested double quotes: cmd.exe strips them, which corrupts the argument.
    // Requiring this workspace path keeps other Nest projects' watchers untouched.
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'nest\\.js.*--watch' -and $_.CommandLine -like '*${process.cwd()}*' } | Select-Object -ExpandProperty ProcessId`;
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, {
      encoding: 'utf8',
    });
    for (const raw of out.split(/\r?\n/)) {
      const pid = raw.trim();
      if (!pid || pid === '0') continue;
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      console.log(`Stopped nest --watch process ${pid}`);
    }
  } catch {
    // no watcher
  }
}

function main() {
  const envPath = resolve(process.cwd(), '../../.env');
  if (existsSync(envPath)) {
    config({ path: envPath });
  }

  const port = process.env.API_PORT ?? '3001';
  killNestWatchers();

  if (process.platform === 'win32') {
    try {
      const output = execSync(
        `netstat -ano | findstr ":${port}" | findstr LISTENING`,
        { encoding: 'utf8' },
      );
      const pid = output.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'inherit' });
        console.log(`Stopped process ${pid} on port ${port}`);
        return;
      }
    } catch {
      // no listener
    }
  } else {
    try {
      execSync(
        `pgrep -f 'nest start --watch' | xargs -r kill -9; lsof -ti:${port} | xargs -r kill -9`,
        { stdio: 'inherit' },
      );
      console.log(`Stopped process on port ${port}`);
      return;
    } catch {
      // no listener
    }
  }

  console.log(`No process listening on port ${port}`);
}

main();

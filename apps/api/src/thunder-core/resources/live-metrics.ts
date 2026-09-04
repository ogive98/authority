import { cpus, freemem, totalmem } from 'node:os';

/**
 * Process CPU and host RAM probes. loadavg is unused: it is always 0 on win32.
 */

export type CpuProbe = {
  sample: () => number | null;
};

/** Process CPU ratio across cores — works on win32 (loadavg does not). */
export function createProcessCpuProbe(): CpuProbe {
  let last = process.cpuUsage();
  let lastMs = Date.now();
  const cores = Math.max(1, cpus().length);

  return {
    sample() {
      const now = process.cpuUsage();
      const elapsedMs = Math.max(1, Date.now() - lastMs);
      const deltaUs = now.user - last.user + (now.system - last.system);
      last = now;
      lastMs = Date.now();
      const budgetUs = elapsedMs * 1000 * cores;
      if (budgetUs <= 0) return null;
      return Math.min(1, Math.max(0, deltaUs / budgetUs));
    },
  };
}

export function sampleRamUsageRatio(): number {
  const total = totalmem();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (total - freemem()) / total));
}

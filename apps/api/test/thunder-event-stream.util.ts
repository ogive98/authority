import type Redis from 'ioredis';
import { thunderEventStreamKey } from '../src/thunder-core/thunder.constants';

/** Clear Redis stream + consumer groups so e2e runs are not poisoned by backlog. */
export async function resetThunderEventStream(
  redis: Redis | null | undefined,
): Promise<void> {
  if (!redis) {
    return;
  }

  const streamKey = thunderEventStreamKey();
  try {
    const groups = (await redis.xinfo('GROUPS', streamKey)) as Array<
      Array<string | number>
    >;
    for (const group of groups) {
      const nameIndex = group.findIndex(
        (entry, index) => entry === 'name' && index % 2 === 0,
      );
      const name = nameIndex >= 0 ? group[nameIndex + 1] : undefined;
      if (typeof name === 'string') {
        await redis.xgroup('DESTROY', streamKey, name);
      }
    }
  } catch {
    // Stream may not exist yet.
  }

  try {
    await redis.del(streamKey);
  } catch {
    // ignore
  }
}

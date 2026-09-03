import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL;
    this.client = url
      ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
      : null;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const raw = await this.client.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // cache is optional — license still works from DB
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      await this.client.del(key);
    } catch {
      // ignore
    }
  }

  /** SET key value EX ttl NX — returns true when the lock was acquired. */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.client) {
      return true;
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return true;
    }
  }

  async getUsedMemoryBytes(): Promise<number | null> {
    if (!this.client) {
      return null;
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const info = await this.client.info('memory');
      const match = /used_memory:(\d+)/.exec(info);
      return match ? Number(match[1]) : null;
    } catch {
      return null;
    }
  }

  duplicateClient(): Redis | null {
    if (!this.client) {
      return null;
    }
    return this.client.duplicate();
  }

  /** BullMQ requires maxRetriesPerRequest: null on dedicated connections. */
  createBullConnection(): Redis | null {
    const url = process.env.REDIS_URL;
    if (!url) {
      return null;
    }
    return new Redis(url, { maxRetriesPerRequest: null });
  }
}

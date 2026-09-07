import { Logger } from '@nestjs/common';
import type { ModuleManifest } from './manifest.types';
import {
  EVENT_TYPE_PATTERN,
  resolveEventContractsMode,
  type EventContract,
  type EventContractsMode,
} from './event-contract.types';

export const EVENT_CONTRACT_ERROR_CODES = {
  UNKNOWN_EVENT: 'THUNDER.EVENT.UNKNOWN',
  INVALID_EVENT_TYPE: 'THUNDER.EVENT.INVALID_TYPE',
  DUPLICATE_PUBLISHER: 'THUNDER.EVENT.DUPLICATE_PUBLISHER',
  UNKNOWN_CONSUMED: 'THUNDER.EVENT.UNKNOWN_CONSUMED',
} as const;

export class EventContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EventContractError';
  }
}

function matchesEventPattern(pattern: string, eventType: string): boolean {
  if (pattern === '*') {
    return true;
  }
  if (pattern.endsWith('.*')) {
    return eventType.startsWith(pattern.slice(0, -1));
  }
  return eventType === pattern;
}

export class EventContractRegistry {
  private readonly logger = new Logger(EventContractRegistry.name);
  private readonly byType = new Map<string, EventContract>();

  constructor(
    contracts: EventContract[],
    private readonly mode: EventContractsMode = resolveEventContractsMode(),
  ) {
    for (const contract of contracts) {
      if (!EVENT_TYPE_PATTERN.test(contract.eventType)) {
        throw new EventContractError(
          EVENT_CONTRACT_ERROR_CODES.INVALID_EVENT_TYPE,
          `Invalid event type: ${contract.eventType}`,
        );
      }
      const existing = this.byType.get(contract.eventType);
      if (
        existing &&
        existing.publisherModuleId !== contract.publisherModuleId
      ) {
        throw new EventContractError(
          EVENT_CONTRACT_ERROR_CODES.DUPLICATE_PUBLISHER,
          `Event ${contract.eventType} published by both ${existing.publisherModuleId} and ${contract.publisherModuleId}`,
        );
      }
      this.byType.set(contract.eventType, contract);
    }
  }

  static fromManifests(
    manifests: readonly ModuleManifest[],
    mode?: EventContractsMode,
  ): EventContractRegistry {
    const contracts: EventContract[] = [];
    for (const manifest of manifests) {
      for (const eventType of manifest.publishedEvents ?? []) {
        const versionMatch = /\.v(\d+)$/.exec(eventType);
        contracts.push({
          eventType,
          publisherModuleId: manifest.id,
          version: versionMatch ? Number(versionMatch[1]) : 1,
        });
      }
    }
    return new EventContractRegistry(contracts, mode);
  }

  list(): EventContract[] {
    return [...this.byType.values()].sort((a, b) =>
      a.eventType.localeCompare(b.eventType),
    );
  }

  has(eventType: string): boolean {
    return this.byType.has(eventType);
  }

  get(eventType: string): EventContract | undefined {
    return this.byType.get(eventType);
  }

  assertPublishable(eventType: string): void {
    if (this.mode === 'off') {
      return;
    }
    if (!EVENT_TYPE_PATTERN.test(eventType)) {
      const err = new EventContractError(
        EVENT_CONTRACT_ERROR_CODES.INVALID_EVENT_TYPE,
        `Invalid event type format: ${eventType}`,
      );
      if (this.mode === 'strict') {
        throw err;
      }
      this.logger.warn(err.message);
      return;
    }
    if (!this.byType.has(eventType)) {
      const err = new EventContractError(
        EVENT_CONTRACT_ERROR_CODES.UNKNOWN_EVENT,
        `Event type not in contract registry: ${eventType}`,
      );
      if (this.mode === 'strict') {
        throw err;
      }
      this.logger.warn(err.message);
    }
  }

  assertConsumedEventsDeclared(
    moduleId: string,
    consumedEvents: string[],
  ): void {
    for (const pattern of consumedEvents) {
      if (pattern === '*') {
        continue;
      }
      const matched = this.list().some((c) =>
        matchesEventPattern(pattern, c.eventType),
      );
      if (!matched) {
        throw new EventContractError(
          EVENT_CONTRACT_ERROR_CODES.UNKNOWN_CONSUMED,
          `Module ${moduleId} consumedEvents pattern "${pattern}" matches no published contract`,
        );
      }
    }
  }

  consumerAccepts(consumes: string[] | undefined, eventType: string): boolean {
    if (!consumes || consumes.length === 0 || consumes.includes('*')) {
      return true;
    }
    return consumes.some((pattern) => matchesEventPattern(pattern, eventType));
  }
}

let defaultRegistry: EventContractRegistry | null = null;

export function resetDefaultEventContractRegistry(): void {
  defaultRegistry = null;
}

export function getDefaultEventContractRegistry(
  manifests?: readonly ModuleManifest[],
): EventContractRegistry {
  if (!defaultRegistry || manifests) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { STATIC_MODULE_MANIFESTS } = require('./manifests') as {
      STATIC_MODULE_MANIFESTS: readonly ModuleManifest[];
    };
    defaultRegistry = EventContractRegistry.fromManifests(
      manifests ?? STATIC_MODULE_MANIFESTS,
    );
  }
  return defaultRegistry;
}

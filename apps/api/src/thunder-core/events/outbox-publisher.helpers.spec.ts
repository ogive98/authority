import {
  clampOutboxBatchSize,
  resolveOutboxBatchSize,
} from './outbox-publisher.service';
import { resolveOutboxMaxPublishAttempts } from '../../common/json-safety';

describe('outbox publisher helpers', () => {
  it('clamps batch size to 1–200', () => {
    expect(clampOutboxBatchSize(0)).toBe(1);
    expect(clampOutboxBatchSize(50)).toBe(50);
    expect(clampOutboxBatchSize(999)).toBe(200);
    expect(clampOutboxBatchSize(Number.NaN)).toBe(100);
  });

  it('resolves batch from env-like raw', () => {
    expect(resolveOutboxBatchSize(undefined)).toBe(100);
    expect(resolveOutboxBatchSize('25')).toBe(25);
  });

  it('resolves max publish attempts', () => {
    expect(resolveOutboxMaxPublishAttempts(undefined)).toBe(5);
    expect(resolveOutboxMaxPublishAttempts('3')).toBe(3);
    expect(resolveOutboxMaxPublishAttempts('0')).toBe(5);
  });
});

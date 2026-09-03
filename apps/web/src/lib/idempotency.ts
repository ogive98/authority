/**
 * Idempotency-Key helper for confirm / send / print / pay.
 * Client generates once per user intent; server dedupes.
 */
export function createIdempotencyKey(prefix = "ui"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

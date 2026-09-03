/**
 * Minimal JSONLogic sandbox — no eval, whitelist operators only (THU-08).
 */
const ALLOWED_OPS = new Set([
  '==',
  '===',
  '!=',
  '!==',
  '!',
  '!!',
  'or',
  'and',
  '>',
  '>=',
  '<',
  '<=',
  'var',
  'in',
  'if',
]);

export function evaluateJsonLogic(
  logic: unknown,
  data: Record<string, unknown>,
): unknown {
  if (logic === null || typeof logic !== 'object' || Array.isArray(logic)) {
    return logic;
  }

  const entries = Object.entries(logic as Record<string, unknown>);
  if (entries.length !== 1) {
    throw new Error('JSONLogic rule must have exactly one operator');
  }

  const [op, rawArgs] = entries[0];
  if (!ALLOWED_OPS.has(op)) {
    throw new Error(`JSONLogic operator not allowed: ${op}`);
  }

  const args: unknown[] = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  switch (op) {
    case 'var': {
      const pathArg = args[0];
      const path = typeof pathArg === 'string' ? pathArg : '';
      const fallback: unknown = args.length > 1 ? args[1] : null;
      return readPath(data, path, fallback);
    }
    case '==':
      return (
        evaluateJsonLogic(args[0], data) == evaluateJsonLogic(args[1], data)
      );
    case '===':
      return (
        evaluateJsonLogic(args[0], data) === evaluateJsonLogic(args[1], data)
      );
    case '!=':
      return (
        evaluateJsonLogic(args[0], data) != evaluateJsonLogic(args[1], data)
      );
    case '!==':
      return (
        evaluateJsonLogic(args[0], data) !== evaluateJsonLogic(args[1], data)
      );
    case '!':
      return !evaluateJsonLogic(args[0], data);
    case '!!':
      return Boolean(evaluateJsonLogic(args[0], data));
    case 'or':
      for (const arg of args) {
        if (evaluateJsonLogic(arg, data)) {
          return true;
        }
      }
      return false;
    case 'and':
      for (const arg of args) {
        if (!evaluateJsonLogic(arg, data)) {
          return false;
        }
      }
      return true;
    case '>':
      return (
        Number(evaluateJsonLogic(args[0], data)) >
        Number(evaluateJsonLogic(args[1], data))
      );
    case '>=':
      return (
        Number(evaluateJsonLogic(args[0], data)) >=
        Number(evaluateJsonLogic(args[1], data))
      );
    case '<':
      return (
        Number(evaluateJsonLogic(args[0], data)) <
        Number(evaluateJsonLogic(args[1], data))
      );
    case '<=':
      return (
        Number(evaluateJsonLogic(args[0], data)) <=
        Number(evaluateJsonLogic(args[1], data))
      );
    case 'in': {
      const needle = evaluateJsonLogic(args[0], data);
      const haystack = evaluateJsonLogic(args[1], data);
      if (typeof haystack === 'string') {
        return haystack.includes(String(needle));
      }
      if (Array.isArray(haystack)) {
        return haystack.includes(needle);
      }
      return false;
    }
    case 'if': {
      // if [cond, then, else?]
      if (evaluateJsonLogic(args[0], data)) {
        return evaluateJsonLogic(args[1], data);
      }
      return args.length > 2 ? evaluateJsonLogic(args[2], data) : null;
    }
    default:
      throw new Error(`Unhandled operator: ${op}`);
  }
}

function readPath(
  data: Record<string, unknown>,
  path: string,
  fallback: unknown,
): unknown {
  if (!path) {
    return data;
  }
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current === undefined ? fallback : current;
}

export function evaluateJsonLogicWithTimeout(
  logic: unknown,
  data: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setTimeout(() => {
      reject(new Error(`JSONLogic evaluation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const result = evaluateJsonLogic(logic, data);
      clearTimeout(timer);
      if (Date.now() - started > timeoutMs) {
        reject(
          new Error(`JSONLogic evaluation timed out after ${timeoutMs}ms`),
        );
        return;
      }
      resolve(result);
    } catch (error) {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

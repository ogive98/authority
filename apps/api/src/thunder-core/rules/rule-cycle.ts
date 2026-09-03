import type { RuleAction, ThunderRuleDefinition } from './rule.types';

export function matchesEventPattern(
  pattern: string,
  eventType: string,
): boolean {
  if (pattern === '*' || pattern === '**') {
    return true;
  }
  if (pattern.endsWith('*')) {
    return eventType.startsWith(pattern.slice(0, -1));
  }
  return eventType === pattern;
}

/** Build edges eventPattern → emitted event types from enqueue_job.emitsEventType */
export function detectRuleCycles(
  rules: Array<
    Pick<ThunderRuleDefinition, 'eventPattern' | 'actions' | 'enabled'>
  >,
): string[] | null {
  const edges = new Map<string, Set<string>>();

  for (const rule of rules) {
    if (rule.enabled === false) {
      continue;
    }
    const emits = collectEmits(rule.actions);
    if (emits.length === 0) {
      continue;
    }
    const from = rule.eventPattern;
    const set = edges.get(from) ?? new Set<string>();
    for (const eventType of emits) {
      set.add(eventType);
    }
    edges.set(from, set);
  }

  // Also connect: if pattern P matches emitted E, treat P→neighbors as reachable from emitters of E
  // Cycle check via DFS on explicit emit graph + pattern matching nodes.
  const nodes = new Set<string>([...edges.keys()]);
  for (const targets of edges.values()) {
    for (const t of targets) {
      nodes.add(t);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function neighbors(node: string): string[] {
    const out = new Set<string>();
    const direct = edges.get(node);
    if (direct) {
      for (const t of direct) {
        out.add(t);
      }
    }
    // From a concrete event type, follow rules whose pattern matches it
    for (const [pattern, targets] of edges.entries()) {
      if (matchesEventPattern(pattern, node)) {
        for (const t of targets) {
          out.add(t);
        }
      }
    }
    return [...out];
  }

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      return path.slice(start).concat(node);
    }
    if (visited.has(node)) {
      return null;
    }
    visiting.add(node);
    path.push(node);
    for (const next of neighbors(node)) {
      const cycle = dfs(next);
      if (cycle) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of nodes) {
    const cycle = dfs(node);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

function collectEmits(actions: RuleAction[]): string[] {
  const out: string[] = [];
  for (const action of actions) {
    if (action.type === 'enqueue_job' && action.emitsEventType) {
      out.push(action.emitsEventType);
    }
  }
  return out;
}

export function assertActionsWhitelisted(actions: RuleAction[]): void {
  for (const action of actions) {
    if (action.type !== 'enqueue_job' && action.type !== 'notify') {
      throw new Error(
        `Action type not allowed: ${(action as { type: string }).type}`,
      );
    }
    if (action.type === 'enqueue_job') {
      if (!action.jobType || !action.queue) {
        throw new Error('enqueue_job requires jobType and queue');
      }
    }
    if (action.type === 'notify') {
      if (!action.templateId || !action.channel) {
        throw new Error('notify requires templateId and channel');
      }
      if (action.channel !== 'ui' && action.channel !== 'email') {
        throw new Error('notify channel must be ui|email');
      }
    }
  }
}

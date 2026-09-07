import { Injectable } from '@nestjs/common';
import { FinAllocationPolicy, FinOpenItemStatus } from '@prisma/client';

export type AllocatableOpenItem = {
  id: string;
  number: string;
  amountOpen: number;
  dueDate: Date | null;
  createdAt: Date;
};

export type AllocationLinePlan = {
  openItemId: string;
  openItemNumber: string;
  amount: number;
  amountOpenBefore: number;
};

export type AllocationPlan = {
  policy: FinAllocationPolicy;
  customerId: string;
  paymentAmount: number;
  lines: AllocationLinePlan[];
  remainder: number;
};

/**
 * Deterministic AR allocation planner (policies A–G).
 * Pure — no DB. Confirm path applies lines transactionally elsewhere.
 */
@Injectable()
export class AllocationEngineService {
  simulate(input: {
    policy: FinAllocationPolicy;
    customerId: string;
    paymentAmount: number;
    openItems: AllocatableOpenItem[];
    manualLines?: { openItemId: string; amount: number }[];
  }): AllocationPlan {
    const pay = round3(input.paymentAmount);
    const open = input.openItems.filter(
      (i) => i.amountOpen > 1e-9,
    ) as AllocatableOpenItem[];

    if (input.policy === FinAllocationPolicy.MANUAL) {
      return this.manualPlan(input.customerId, pay, open, input.manualLines ?? []);
    }

    const ordered = this.order(open, input.policy);
    if (input.policy === FinAllocationPolicy.PROPORTIONAL) {
      return this.proportional(input.customerId, pay, ordered);
    }

    const lines: AllocationLinePlan[] = [];
    let remaining = pay;
    for (const item of ordered) {
      if (remaining <= 1e-9) break;
      const take = round3(Math.min(item.amountOpen, remaining));
      if (take <= 0) continue;
      lines.push({
        openItemId: item.id,
        openItemNumber: item.number,
        amount: take,
        amountOpenBefore: item.amountOpen,
      });
      remaining = round3(remaining - take);
    }

    return {
      policy: input.policy,
      customerId: input.customerId,
      paymentAmount: pay,
      lines,
      remainder: Math.max(0, remaining),
    };
  }

  private order(
    items: AllocatableOpenItem[],
    policy: FinAllocationPolicy,
  ): AllocatableOpenItem[] {
    const copy = [...items];
    const today = startOfDay(new Date());
    switch (policy) {
      case FinAllocationPolicy.OLDEST_FIRST:
        return copy.sort((a, b) => {
          const da = a.dueDate?.getTime() ?? a.createdAt.getTime();
          const db = b.dueDate?.getTime() ?? b.createdAt.getTime();
          return da - db || a.createdAt.getTime() - b.createdAt.getTime();
        });
      case FinAllocationPolicy.NEWEST_FIRST:
        return copy.sort((a, b) => {
          const da = a.dueDate?.getTime() ?? a.createdAt.getTime();
          const db = b.dueDate?.getTime() ?? b.createdAt.getTime();
          return db - da || b.createdAt.getTime() - a.createdAt.getTime();
        });
      case FinAllocationPolicy.COMPLETION_FIRST:
        return copy.sort(
          (a, b) =>
            a.amountOpen - b.amountOpen ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
      case FinAllocationPolicy.LARGEST_FIRST:
        return copy.sort(
          (a, b) =>
            b.amountOpen - a.amountOpen ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
      case FinAllocationPolicy.OVERDUE_FIRST:
        return copy.sort((a, b) => {
          const ao = isOverdue(a.dueDate, today) ? 0 : 1;
          const bo = isOverdue(b.dueDate, today) ? 0 : 1;
          if (ao !== bo) return ao - bo;
          const da = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
          const db = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
          return da - db || a.createdAt.getTime() - b.createdAt.getTime();
        });
      default:
        return copy.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
    }
  }

  private proportional(
    customerId: string,
    pay: number,
    items: AllocatableOpenItem[],
  ): AllocationPlan {
    const totalOpen = round3(items.reduce((s, i) => s + i.amountOpen, 0));
    if (totalOpen <= 0 || pay <= 0) {
      return {
        policy: FinAllocationPolicy.PROPORTIONAL,
        customerId,
        paymentAmount: pay,
        lines: [],
        remainder: pay,
      };
    }
    const apply = round3(Math.min(pay, totalOpen));
    const lines: AllocationLinePlan[] = [];
    let allocated = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      let take: number;
      if (i === items.length - 1) {
        take = round3(Math.min(item.amountOpen, apply - allocated));
      } else {
        take = round3(
          Math.min(item.amountOpen, (item.amountOpen / totalOpen) * apply),
        );
      }
      if (take > 0) {
        lines.push({
          openItemId: item.id,
          openItemNumber: item.number,
          amount: take,
          amountOpenBefore: item.amountOpen,
        });
        allocated = round3(allocated + take);
      }
    }
    return {
      policy: FinAllocationPolicy.PROPORTIONAL,
      customerId,
      paymentAmount: pay,
      lines,
      remainder: round3(Math.max(0, pay - allocated)),
    };
  }

  private manualPlan(
    customerId: string,
    pay: number,
    open: AllocatableOpenItem[],
    manual: { openItemId: string; amount: number }[],
  ): AllocationPlan {
    const byId = new Map(open.map((o) => [o.id, o]));
    const lines: AllocationLinePlan[] = [];
    let used = 0;
    for (const m of manual) {
      const item = byId.get(m.openItemId);
      if (!item) continue;
      const take = round3(Math.min(item.amountOpen, Math.max(0, m.amount)));
      if (take <= 0) continue;
      if (used + take > pay + 1e-9) break;
      lines.push({
        openItemId: item.id,
        openItemNumber: item.number,
        amount: take,
        amountOpenBefore: item.amountOpen,
      });
      used = round3(used + take);
    }
    return {
      policy: FinAllocationPolicy.MANUAL,
      customerId,
      paymentAmount: pay,
      lines,
      remainder: round3(Math.max(0, pay - used)),
    };
  }
}

export function nextOpenStatus(
  amountOpen: number,
): FinOpenItemStatus {
  if (amountOpen <= 1e-9) return FinOpenItemStatus.CLOSED;
  return FinOpenItemStatus.PARTIAL;
}

function isOverdue(due: Date | null, today: Date): boolean {
  if (!due) return false;
  return startOfDay(due).getTime() < today.getTime();
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

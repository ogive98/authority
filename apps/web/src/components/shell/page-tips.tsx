"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { tipsForPage, type UsageTip } from "@/lib/tips-catalog";
import { useShellStore } from "@/stores/shell-store";
import { cn } from "@/lib/utils";

function helpHref(tip: UsageTip): string {
  if (tip.action.kind === "link" && tip.action.href.startsWith("/help")) {
    return tip.action.href;
  }
  return `/help#tip-${tip.id}`;
}

/**
 * Long-form tip teasers — Launchpad only (`/`), never on feature pages.
 */
export function PageTips({ className }: { className?: string }) {
  const pathname = usePathname();
  const moduleKey = useShellStore((s) => s.selectedModuleId);

  // Only on the submodule icons Launchpad — not finance/invoices, delivery, etc.
  if (pathname !== "/") return null;

  const tips = tipsForPage(pathname, moduleKey, 6);

  if (tips.length === 0) return null;

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-2xl px-6 pb-14 pt-10 md:px-10",
        className,
      )}
      aria-label="Astuces d’utilisation"
    >
      <div
        className="mb-8 h-px w-full bg-gradient-to-r from-transparent via-a-fg-subtle/30 to-transparent"
        aria-hidden
      />

      <header className="mb-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-a-fg-subtle">
          À retenir
        </p>
        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-a-fg">
          Astuces & fonctionnalités
        </h2>
      </header>

      <ul className="space-y-8">
        {tips.map((tip) => (
          <li key={tip.id} className="text-center sm:text-left">
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-a-fg">
              {tip.title}
              {tip.shortcut ? (
                <kbd className="a-mono ml-2 align-middle text-[11px] font-medium text-a-fg-subtle">
                  {tip.shortcut}
                </kbd>
              ) : null}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-a-fg-muted">
              {tip.body}
            </p>
            <Link
              href={helpHref(tip)}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-a-accent hover:underline"
            >
              Continuer dans l’aide
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-center text-[12px] text-a-fg-subtle">
        <Link href="/help" className="font-medium text-a-accent hover:underline">
          Centre d’aide
        </Link>
        {" · "}
        <Link
          href="/help/guide"
          className="font-medium text-a-accent hover:underline"
        >
          User Guide
        </Link>
      </p>
    </section>
  );
}

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tipsForPage } from "@/lib/tips-catalog";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";
import {
  personalityForFeature,
  resolveFeatureIcon,
} from "./icon-personality";
import type { RegistryFeature } from "@/lib/registry";

const ICONS_PER_PAGE = 12;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0 || size <= 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Launchpad — apps in viewport; light tip enrichment (not tip pages).
 * Extra icons only → iOS page dots.
 */
export function ModuleAppsGrid({
  moduleKey,
  className,
}: {
  moduleKey?: string;
  className?: string;
}) {
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry } = useMeRegistry();
  const key = moduleKey ?? selectedModuleId;
  const mod =
    registry.modules.find((m) => m.key === key) ?? registry.modules[0];

  const tip = tipsForPage("/", key, 1)[0] ?? null;

  const pages = useMemo(() => {
    if (!mod) return [] as RegistryFeature[][];
    const chunks = chunk(mod.features, ICONS_PER_PAGE);
    return chunks.length ? chunks : [[] as RegistryFeature[]];
  }, [mod]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [key]);

  const goTo = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(index, pages.length - 1));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
      setPageIndex(clamped);
    },
    [pages.length],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        setPageIndex(Math.round(el.scrollLeft / w));
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pages.length]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(pageIndex + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(pageIndex - 1);
    }
  }

  if (!mod) {
    return (
      <p className="text-center text-[13px] text-a-fg-muted">Aucun module.</p>
    );
  }

  return (
    <section
      className={cn(
        "a-launchpad flex h-full min-h-0 w-full flex-col",
        className,
      )}
      aria-label={mod.name}
      onKeyDown={onKeyDown}
    >
      <div
        ref={scrollerRef}
        className="a-launchpad-scroller min-h-0 flex-1 touch-pan-x"
        tabIndex={0}
        role="region"
        aria-roledescription="carrousel"
        aria-label={`Apps ${mod.name}`}
      >
        {pages.map((features, i) => (
          <div
            key={`apps-${i}`}
            className="a-launchpad-page"
            aria-hidden={i !== pageIndex}
          >
            <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 py-4 md:px-10">
              <header className="mb-6 shrink-0 text-center sm:mb-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
                  Applications
                </p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.022em] text-a-fg">
                  {mod.name}
                </h2>
              </header>

              {features.length === 0 ? (
                <p className="text-[13px] text-a-fg-muted">
                  Aucune fonctionnalité pour ce module.
                </p>
              ) : (
                <ul className="flex max-w-3xl flex-wrap items-start justify-center gap-x-6 gap-y-7 sm:gap-x-7 sm:gap-y-8">
                  {features.map((f) => {
                    const Icon = resolveFeatureIcon(f.id, f.label);
                    const p = personalityForFeature(f.id, f.label);
                    return (
                      <li key={f.id}>
                        <Link
                          href={f.href}
                          className={cn(
                            "a-app-tile group",
                            `a-motion-${p.motion}`,
                          )}
                          data-kind={p.kind}
                          data-motion={p.motion}
                        >
                          <span
                            className={cn("a-app-icon", p.colorClass)}
                            aria-hidden
                          >
                            {p.motion === "smoke" ? (
                              <span className="a-fx-smoke" aria-hidden>
                                <i />
                                <i />
                                <i />
                              </span>
                            ) : null}
                            <Icon
                              className="a-app-glyph h-14 w-14"
                              strokeWidth={1.2}
                            />
                          </span>
                          <span className="label">{f.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {i === 0 && tip ? (
                <aside className="mt-8 max-w-md shrink-0 text-center">
                  <p className="text-[12px] leading-relaxed text-a-fg-muted">
                    <span className="font-medium text-a-fg">{tip.title}</span>
                    {" — "}
                    {tip.body.length > 140
                      ? `${tip.body.slice(0, 137)}…`
                      : tip.body}
                  </p>
                  <Link
                    href={
                      tip.action.kind === "link" &&
                      tip.action.href.startsWith("/help")
                        ? tip.action.href
                        : `/help#tip-${tip.id}`
                    }
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-a-accent hover:underline"
                  >
                    Aide
                    <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
                  </Link>
                </aside>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {pages.length > 1 ? (
        <nav
          className="a-page-dots shrink-0"
          aria-label="Pagination Launchpad"
        >
          {pages.map((_, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              className={cn("a-page-dot", i === pageIndex && "a-page-dot-active")}
              aria-label={`Apps, page ${i + 1}`}
              aria-current={i === pageIndex ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </nav>
      ) : null}
    </section>
  );
}

"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  COMMAND_CATALOG,
  DEMO_ENABLED_MODULES,
  DEMO_PERMISSION_GRANTS,
  filterCommands,
  formatShortcutKeys,
  groupCommands,
  type CommandItem,
} from "@/lib/command-catalog";

export type ACommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grants?: Set<string>;
  enabledModules?: Set<string>;
};

/**
 * iOS Spotlight-like palette: search pill grows while typing, shrinks when empty;
 * results restagger on each keystroke.
 */
export function ACommandPalette({
  open,
  onOpenChange,
  grants = DEMO_PERMISSION_GRANTS,
  enabledModules = DEMO_ENABLED_MODULES,
}: ACommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      filterCommands(COMMAND_CATALOG, {
        query,
        grants,
        enabledModules,
      }),
    [query, grants, enabledModules],
  );

  const groups = useMemo(() => groupCommands(filtered), [filtered]);
  const flat = filtered;
  /** Grow only when there is text — shrinks again when cleared. */
  const expanded = query.length > 0;
  const listOpen = flat.length > 0 || query.length > 0;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      if (item.id === "act-theme") {
        const cur =
          document.documentElement.getAttribute("data-theme") === "light"
            ? "light"
            : "dark";
        document.documentElement.setAttribute(
          "data-theme",
          cur === "dark" ? "light" : "dark",
        );
        return;
      }
      if (item.href) {
        router.push(item.href);
      }
    },
    [onOpenChange, router],
  );

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) run(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
        return;
      }
      onOpenChange(false);
    }
  }

  let index = -1;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="a-palette-overlay fixed inset-0 z-[var(--a-z-modal)]" />
        <Dialog.Content
          className={cn(
            "a-palette-panel fixed top-[10%] left-1/2 z-[var(--a-z-modal)] -translate-x-1/2",
            "overflow-hidden focus:outline-none",
            "rounded-[1.25rem] border border-a-border-subtle bg-a-surface-2/95 backdrop-blur-xl",
            expanded
              ? "w-[min(100%-1.5rem,36rem)]"
              : "w-[min(100%-1.5rem,26rem)]",
          )}
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <Dialog.Description className="sr-only">
            Recherchez une page, une action ou un enregistrement. Flèches et
            Entrée pour naviguer.
          </Dialog.Description>

          <div
            ref={searchRef}
            className={cn(
              "a-palette-search mx-auto mt-3 flex items-center gap-2 rounded-full border border-a-border-subtle bg-a-surface-3 px-3",
              "transition-[width,min-height,padding,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              "motion-reduce:transition-none",
              expanded
                ? "w-[calc(100%-1.25rem)] min-h-12 px-4 py-2.5 shadow-[0_0_0_3px_color-mix(in_srgb,var(--a-accent)_22%,transparent)]"
                : "w-[min(100%-2rem,18rem)] min-h-10 px-3 py-1.5",
            )}
          >
            <Search
              className={cn(
                "shrink-0 text-a-fg-subtle transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                "motion-reduce:transition-none",
                expanded ? "h-5 w-5 text-a-accent" : "h-4 w-4",
              )}
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                const el = searchRef.current;
                if (el && next.length > 0) {
                  el.classList.remove("a-palette-typing");
                  void el.offsetWidth;
                  el.classList.add("a-palette-typing");
                }
              }}
              placeholder="Rechercher…"
              className={cn(
                "a-palette-input min-w-0 flex-1 bg-transparent text-a-fg outline-none placeholder:text-a-fg-subtle",
                "transition-[font-size,letter-spacing] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                "motion-reduce:transition-none",
                expanded
                  ? "text-[length:var(--a-text-lg)] tracking-tight"
                  : "text-[length:var(--a-text-md)]",
              )}
              aria-autocomplete="list"
              aria-controls="command-list"
              aria-activedescendant={
                flat[active] ? `cmd-${flat[active]!.id}` : undefined
              }
            />
            {query ? (
              <button
                type="button"
                className="a-palette-clear inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-a-fg-muted hover:bg-a-surface-4 hover:text-a-fg"
                aria-label="Effacer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            ) : (
              <span className="a-mono hidden shrink-0 text-[length:var(--a-text-xs)] text-a-fg-subtle sm:inline">
                {formatShortcutKeys(["Ctrl", "K"]).join("")}
              </span>
            )}
          </div>

          <div
            className={cn(
              "a-palette-list grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              "motion-reduce:transition-none",
              listOpen
                ? "mt-2 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div
                id="command-list"
                ref={listRef}
                role="listbox"
                className="max-h-72 overflow-y-auto px-2 pt-1 pb-1"
                key={query}
              >
                {groups.length === 0 ? (
                  <p className="a-palette-item px-3 py-8 text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Aucun résultat
                  </p>
                ) : (
                  groups.map((g) => (
                    <div key={g.group} className="mb-1.5">
                      <p className="a-mono px-2.5 py-1 text-[length:var(--a-text-xs)] uppercase tracking-wider text-a-fg-subtle">
                        {g.label}
                      </p>
                      <ul>
                        {g.items.map((item) => {
                          index += 1;
                          const i = index;
                          const isActive = i === active;
                          return (
                            <li
                              key={item.id}
                              role="option"
                              aria-selected={isActive}
                              className="a-palette-item"
                              style={{
                                animationDelay: `${Math.min(i, 12) * 28}ms`,
                              }}
                            >
                              <button
                                type="button"
                                id={`cmd-${item.id}`}
                                data-cmd-index={i}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left text-[length:var(--a-text-sm)]",
                                  "transition-colors duration-150",
                                  isActive
                                    ? "bg-a-accent-muted text-a-fg"
                                    : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                                )}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => run(item)}
                              >
                                <span className="min-w-0 truncate">
                                  {item.label}
                                </span>
                                {item.shortcut ? (
                                  <span
                                    className="flex shrink-0 items-center gap-0.5"
                                    aria-label={`Raccourci ${formatShortcutKeys(item.shortcut.keys).join("+")}`}
                                  >
                                    {formatShortcutKeys(item.shortcut.keys).map(
                                      (k) => (
                                        <kbd
                                          key={`${item.id}-${k}`}
                                          className="a-mono inline-flex min-w-[1.25rem] items-center justify-center rounded-md border border-a-border-subtle bg-a-surface-1/80 px-1 py-0.5 text-[length:var(--a-text-xs)] text-a-fg-subtle"
                                        >
                                          {k}
                                        </kbd>
                                      ),
                                    )}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center gap-3 px-4 a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle",
              "transition-[padding,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              expanded ? "py-2.5 opacity-100" : "py-2 opacity-70",
            )}
          >
            <span>↑↓</span>
            <span>↵</span>
            <span>esc</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

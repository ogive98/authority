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
  DEMO_ENABLED_MODULES,
  DEMO_PERMISSION_GRANTS,
  filterCommands,
  formatShortcutKeys,
  groupCommands,
  type CommandItem,
} from "@/lib/command-catalog";
import { ACTION_REGISTRY } from "@/lib/action-registry";

export type ACommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grants?: Set<string>;
  enabledModules?: Set<string>;
};

/**
 * Spotlight-style command palette — Soft Glass / Enterprise OS (Action Registry).
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
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      filterCommands(ACTION_REGISTRY, {
        query,
        grants,
        enabledModules,
      }),
    [query, grants, enabledModules],
  );

  const groups = useMemo(() => groupCommands(filtered), [filtered]);
  const flat = filtered;
  const listOpen = query.length > 0;

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
      if (item.href) router.push(item.href);
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
        <Dialog.Overlay className="a-spotlight-overlay fixed inset-0 z-[var(--a-z-modal)]" />
        <Dialog.Content
          className={cn(
            "a-spotlight-panel fixed top-[18%] right-0 left-0 z-[var(--a-z-modal)] mx-auto",
            "w-[min(100%-1.25rem,28rem)] focus:outline-none",
          )}
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <Dialog.Description className="sr-only">
            Tapez pour rechercher une page ou une action.
          </Dialog.Description>

          <div className="a-spotlight-field flex items-center gap-3 px-4 py-3.5">
            <Search
              className="h-[18px] w-[18px] shrink-0 text-a-accent"
              strokeWidth={1.6}
              aria-hidden
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Que cherchez-vous ?"
              className="a-palette-input min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-0.02em] text-a-fg outline-none placeholder:font-normal placeholder:text-a-fg-subtle"
              aria-autocomplete="list"
              aria-controls="command-list"
              aria-activedescendant={
                flat[active] ? `cmd-${flat[active]!.id}` : undefined
              }
            />
            {query ? (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
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
              <kbd className="a-mono hidden rounded-md bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-subtle sm:inline">
                esc
              </kbd>
            )}
          </div>

          {listOpen ? (
            <div className="a-spotlight-results">
              <div
                id="command-list"
                ref={listRef}
                role="listbox"
                className="max-h-[min(50vh,20rem)] overflow-y-auto px-2 py-2"
                key={query}
              >
                {groups.length === 0 ? (
                  <p className="px-3 py-10 text-center text-[13px] text-a-fg-muted">
                    Aucun résultat pour « {query} »
                  </p>
                ) : (
                  groups.map((g) => (
                    <div key={g.group} className="mb-2">
                      <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-a-fg-subtle">
                        {g.label}
                      </p>
                      <ul>
                        {g.items.map((item) => {
                          index += 1;
                          const i = index;
                          const isActive = i === active;
                          return (
                            <li key={item.id} role="option" aria-selected={isActive}>
                              <button
                                type="button"
                                id={`cmd-${item.id}`}
                                data-cmd-index={i}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors",
                                  isActive
                                    ? "bg-a-accent text-white"
                                    : "text-a-fg hover:bg-a-surface-3",
                                )}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => run(item)}
                              >
                                <span className="min-w-0 truncate font-medium">
                                  {item.label}
                                </span>
                                {item.shortcut ? (
                                  <span className="flex shrink-0 gap-0.5 opacity-80">
                                    {formatShortcutKeys(item.shortcut.keys).map(
                                      (k) => (
                                        <kbd
                                          key={`${item.id}-${k}`}
                                          className={cn(
                                            "a-mono rounded px-1 py-0.5 text-[10px]",
                                            isActive
                                              ? "bg-white/20 text-white"
                                              : "bg-a-surface-3 text-a-fg-subtle",
                                          )}
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
              <div className="flex items-center justify-between px-4 py-2.5 text-[11px] text-a-fg-subtle">
                <span>↑↓ naviguer · ↵ ouvrir</span>
                <LinkHint />
              </div>
            </div>
          ) : (
            <div className="px-4 pb-4 pt-1">
              <p className="text-[12px] leading-relaxed text-a-fg-muted">
                Pages, modules, actions — commencez à taper. Ouvrez aussi depuis
                la loupe ou ⌘K.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LinkHint() {
  return (
    <span className="a-mono text-[10px] tracking-wide">⌘K</span>
  );
}

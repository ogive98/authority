"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AInput } from "./a-input";
import { cn } from "@/lib/utils";

export type AComboboxOption = {
  id: string;
  label: string;
  hint?: string;
};

type AComboboxProps = {
  label?: string;
  valueId: string | null;
  displayValue: string;
  onDisplayChange: (text: string) => void;
  onSelect: (option: AComboboxOption) => void;
  /** Called when the field opens (focus) so parent can prefetch options. */
  onOpen?: () => void;
  options: AComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Typeahead combobox. The listbox is rendered inline (absolute below the
 * field) on purpose: portaling to document.body breaks pointer-events inside
 * Radix modal dialogs (body gets pointer-events:none), and a fixed popup
 * inside Dialog.Content breaks under backdrop-filter ancestors. Inline keeps
 * clicks, focus-scope and dismiss behaviour correct everywhere.
 */
export function ACombobox({
  label,
  valueId,
  displayValue,
  onDisplayChange,
  onSelect,
  onOpen,
  options,
  placeholder,
  emptyText = "Aucune proposition",
  disabled,
  loading,
}: AComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const showList = open;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t)) return;
      const list = document.getElementById(listId);
      if (list?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, listId]);

  const openList = () => {
    setOpen(true);
    setActiveIndex(-1);
  };

  return (
    <div className="relative z-10 space-y-1">
      {label ? (
        <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
          {label}
        </label>
      ) : null}
      <AInput
        ref={inputRef}
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        onFocus={() => {
          openList();
          onOpen?.();
        }}
        onChange={(e) => {
          onDisplayChange(e.target.value);
          if (!open) openList();
          setActiveIndex(-1);
          onOpen?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (options.length === 0) return;
            e.preventDefault();
            if (!open) openList();
            setActiveIndex((i) =>
              e.key === "ArrowDown"
                ? (i + 1) % options.length
                : i <= 0
                  ? options.length - 1
                  : i - 1,
            );
            return;
          }
          if (e.key === "Enter") {
            const target =
              activeIndex >= 0 && activeIndex < options.length
                ? options[activeIndex]
                : options.length === 1
                  ? options[0]
                  : undefined;
            if (target) {
              e.preventDefault();
              onSelect(target);
              setOpen(false);
              return;
            }
            if (open && options.length > 0) {
              // Nothing highlighted and ambiguous list: just close the
              // suggestions. Never overwrite the typed text silently.
              e.preventDefault();
              setOpen(false);
            }
          }
        }}
        className={cn(valueId ? "border-a-accent/40" : undefined)}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="a-glass-strong absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-[var(--a-radius-md)] py-1 text-[length:var(--a-text-sm)] shadow-[var(--a-shadow-panel)]"
        >
          {loading ? (
            <li className="px-3 py-2 text-a-fg-muted">Recherche…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-a-fg-muted">{emptyText}</li>
          ) : (
            options.map((opt, i) => (
              <li
                key={opt.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex || opt.id === valueId}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-2 text-left hover:bg-a-surface-3",
                    i === activeIndex && "bg-a-surface-3",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                >
                  <span className="text-a-fg">{opt.label}</span>
                  {opt.hint ? (
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {opt.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

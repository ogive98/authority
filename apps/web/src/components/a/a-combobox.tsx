"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  options: AComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Typeahead with portaled list so drawer overflow does not clip suggestions.
 */
export function ACombobox({
  label,
  valueId,
  displayValue,
  onDisplayChange,
  onSelect,
  options,
  placeholder,
  emptyText = "Aucune proposition",
  disabled,
  loading,
}: AComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updateCoords = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const onScroll = () => updateCoords();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updateCoords, options.length, displayValue]);

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

  const showList = open && (loading || options.length > 0 || displayValue.trim().length > 0);

  return (
    <div className="space-y-1">
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
        onFocus={() => {
          setOpen(true);
          updateCoords();
        }}
        onChange={(e) => {
          onDisplayChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && options[0]) {
            e.preventDefault();
            onSelect(options[0]);
            setOpen(false);
          }
        }}
        className={cn(valueId ? "border-a-accent/40" : undefined)}
      />
      {showList && coords && typeof document !== "undefined"
        ? createPortal(
            <ul
              id={listId}
              role="listbox"
              className="fixed z-[calc(var(--a-z-modal)+20)] max-h-56 overflow-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 py-1 text-[length:var(--a-text-sm)] shadow-md"
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }}
            >
              {loading ? (
                <li className="px-3 py-2 text-a-fg-muted">Recherche…</li>
              ) : options.length === 0 ? (
                <li className="px-3 py-2 text-a-fg-muted">{emptyText}</li>
              ) : (
                options.map((opt) => (
                  <li key={opt.id} role="option" aria-selected={opt.id === valueId}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-a-surface-3"
                      onMouseDown={(e) => e.preventDefault()}
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
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ComboboxField({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="space-y-1">{children}</div>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AButton } from "@/components/a/a-button";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AInput } from "@/components/a/a-input";
import { cn } from "@/lib/utils";
import {
  LOT_COLUMNS,
  type LotColumnId,
  type LotFilter,
  type LotRow,
  type LotStatus,
  pageLots,
} from "@/lib/mock-lots";

const PAGE_SIZE = 50;
const VIEWS_KEY = "authority.datatable.lot-views";

type SavedView = {
  id: string;
  name: string;
  filter: LotFilter;
  columns: LotColumnId[];
};

function loadViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedView[];
  } catch {
    return [];
  }
}

function saveViews(views: SavedView[]) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
}

export type ADataTableLotsProps = {
  /** Full dataset stays in memory; UI only pages via cursor. */
  rows: LotRow[];
  onRowClick?: (row: LotRow) => void;
};

export function ADataTableLots({ rows, onRowClick }: ADataTableLotsProps) {
  const [filter, setFilter] = useState<LotFilter>({ status: "all", q: "" });
  const [columns, setColumns] = useState<LotColumnId[]>(
    LOT_COLUMNS.map((c) => c.id),
  );
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [views, setViews] = useState<SavedView[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setViews(loadViews());
  }, []);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const page = useMemo(
    () => pageLots(rows, { cursor, limit: PAGE_SIZE, filter }),
    [rows, cursor, filter],
  );

  // Reset pagination when filter changes
  const applyFilter = useCallback((next: LotFilter) => {
    setFilter(next);
    setCursorStack([null]);
    setSelected(new Set());
  }, []);

  const visibleCols = LOT_COLUMNS.filter((c) => columns.includes(c.id));

  function toggleColumn(id: LotColumnId) {
    setColumns((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    const ids = page.items.map((r) => r.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function saveCurrentView() {
    const name = window.prompt("Nom de la vue");
    if (!name?.trim()) return;
    const view: SavedView = {
      id: `view_${Date.now()}`,
      name: name.trim(),
      filter,
      columns: [...columns],
    };
    const next = [...views, view];
    setViews(next);
    saveViews(next);
  }

  function applyView(view: SavedView) {
    setColumns(view.columns);
    applyFilter(view.filter);
  }

  function cellValue(row: LotRow, id: LotColumnId) {
    switch (id) {
      case "qtyKg":
        return (
          <span className="a-mono a-tabular">
            {row.qtyKg.toLocaleString("fr-TN", {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}
          </span>
        );
      case "status":
        return <StatusLabel status={row.status} />;
      case "id":
      case "sku":
        return <span className="a-mono text-[length:var(--a-text-sm)]">{row[id]}</span>;
      default:
        return row[id];
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <AInput
          placeholder="Filtrer lot / SKU / site…"
          value={filter.q ?? ""}
          onChange={(e) =>
            applyFilter({ ...filter, q: e.target.value })
          }
          className="max-w-xs"
        />
        <select
          className="h-9 rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-2 text-[length:var(--a-text-sm)] text-a-fg"
          value={filter.status ?? "all"}
          onChange={(e) =>
            applyFilter({
              ...filter,
              status: e.target.value as LotStatus | "all",
            })
          }
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous statuts</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="quarantine">quarantine</option>
        </select>
        <AButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setPickerOpen((v) => !v)}
        >
          Colonnes
        </AButton>
        <AButton type="button" size="sm" variant="outline" onClick={saveCurrentView}>
          Sauver vue
        </AButton>
        {views.map((v) => (
          <AButton
            key={v.id}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => applyView(v)}
          >
            {v.name}
          </AButton>
        ))}
      </div>

      {pickerOpen ? (
        <div className="a-card flex flex-wrap gap-3 p-3">
          {LOT_COLUMNS.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 text-[length:var(--a-text-sm)]"
            >
              <input
                type="checkbox"
                className="a-checkbox"
                checked={columns.includes(c.id)}
                onChange={() => toggleColumn(c.id)}
              />
              {c.label}
            </label>
          ))}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="flex items-center gap-3 text-[length:var(--a-text-sm)] text-a-fg">
          <span className="font-medium">
            {selected.size} sélectionné(s)
          </span>
          <AButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Effacer
          </AButton>
          <AButton type="button" size="sm" variant="ghost" disabled>
            Bulk (stub)
          </AButton>
        </div>
      ) : null}

      <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
        {page.totalFiltered} / {rows.length} · page {cursorStack.length} · limit{" "}
        {PAGE_SIZE} · jamais unbounded
      </p>

      {page.items.length === 0 ? (
        <AEmptyState
          title="Aucun lot"
          description="Aucun résultat pour ce filtre."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--a-radius-lg)] border border-a-border-subtle">
          <table className="w-full min-w-[640px] border-collapse text-left text-[length:var(--a-text-sm)]">
            <thead className="bg-a-surface-3 text-a-fg-muted">
              <tr>
                <th className="a-table-cell w-10">
                  <input
                    type="checkbox"
                    className="a-checkbox"
                    aria-label="Sélectionner la page"
                    checked={
                      page.items.length > 0 &&
                      page.items.every((r) => selected.has(r.id))
                    }
                    onChange={togglePage}
                  />
                </th>
                {visibleCols.map((c) => (
                  <th
                    key={c.id}
                    className={cn(
                      "a-table-cell font-medium",
                      c.numeric && "text-right",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-a-border-subtle hover:bg-a-surface-3/60",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  <td
                    className="a-table-cell"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="a-checkbox"
                      aria-label={`Sélectionner ${row.id}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  {visibleCols.map((c) => (
                    <td
                      key={c.id}
                      className={cn("a-table-cell", c.numeric && "text-right")}
                    >
                      {cellValue(row, c.id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <AButton
          type="button"
          size="sm"
          variant="secondary"
          disabled={cursorStack.length <= 1}
          onClick={() =>
            setCursorStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
          }
        >
          Précédent
        </AButton>
        <AButton
          type="button"
          size="sm"
          variant="secondary"
          disabled={!page.nextCursor}
          onClick={() => {
            if (page.nextCursor) {
              setCursorStack((s) => [...s, page.nextCursor]);
            }
          }}
        >
          Suivant
        </AButton>
      </div>
    </div>
  );
}

function StatusLabel({ status }: { status: LotStatus }) {
  const color =
    status === "open"
      ? "var(--a-accent)"
      : status === "quarantine"
        ? "var(--a-danger)"
        : "var(--a-fg-muted)";
  return (
    <span
      className="text-[length:var(--a-text-sm)] font-medium capitalize"
      style={{ color }}
    >
      {status}
    </span>
  );
}

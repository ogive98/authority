"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Calculator,
  CalendarDays,
  Languages,
  NotebookPen,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellT } from "@/stores/locale-store";

type ToolDef = {
  id: string;
  labelKey:
    | "toolCalc"
    | "toolCalendar"
    | "toolAgenda"
    | "toolTranslate"
    | "toolNotes";
  icon: LucideIcon;
  url?: string;
  sheet?: "calculator" | "notes";
};

const TOOLS: ToolDef[] = [
  {
    id: "calc",
    labelKey: "toolCalc",
    icon: Calculator,
    sheet: "calculator",
  },
  {
    id: "calendar",
    labelKey: "toolCalendar",
    icon: CalendarDays,
    url: "https://calendar.google.com/calendar/u/0/r",
  },
  {
    id: "agenda",
    labelKey: "toolAgenda",
    icon: NotebookPen,
    url: "https://calendar.google.com/calendar/u/0/r/agenda",
  },
  {
    id: "translate",
    labelKey: "toolTranslate",
    icon: Languages,
    url: "https://translate.google.com/?sl=auto&tl=fr",
  },
  {
    id: "notes",
    labelKey: "toolNotes",
    icon: StickyNote,
    sheet: "notes",
  },
];

const IDLE_MS = 3200;

/** Icons sit on a clean quarter-circle arc (up → left from FAB). */
function arcOffset(index: number, total: number, radiusPx: number) {
  const start = Math.PI / 2;
  const end = Math.PI;
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const angle = start + (end - start) * t;
  return {
    x: Math.cos(angle) * radiusPx,
    y: -Math.sin(angle) * radiusPx,
  };
}

/**
 * Floating toolbox — opaque fan, accent icons, idle → expandable bar (D294).
 */
export function FloatingToolbox() {
  const listId = useId();
  const { t } = useShellT();
  const rootRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<"calculator" | "notes" | null>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<"calculator" | "notes" | null>(null);
  const [idleBar, setIdleBar] = useState(false);
  sheetRef.current = sheet;

  const arc = useMemo(
    () => TOOLS.map((_, i) => arcOffset(i, TOOLS.length, 118)),
    [],
  );

  function clearLeaveTimer() {
    if (leaveTimer.current != null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function clearIdleTimer() {
    if (idleTimer.current != null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }

  function bumpActivity() {
    clearIdleTimer();
    setIdleBar(false);
    if (open || sheetRef.current) return;
    idleTimer.current = setTimeout(() => {
      if (!sheetRef.current && !useShellStore.getState().paletteOpen) {
        setIdleBar(true);
      }
    }, IDLE_MS);
  }

  function openMenu() {
    clearLeaveTimer();
    clearIdleTimer();
    setIdleBar(false);
    setOpen(true);
  }

  function scheduleClose() {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      if (!sheetRef.current) {
        setOpen(false);
        bumpActivity();
      }
    }, 420);
  }

  useEffect(() => {
    bumpActivity();
    return () => {
      clearLeaveTimer();
      clearIdleTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        clearLeaveTimer();
        setOpen(false);
        bumpActivity();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function runTool(tool: ToolDef) {
    if (tool.url) {
      window.open(tool.url, "_blank", "noopener,noreferrer");
      setOpen(false);
      bumpActivity();
      return;
    }
    if (tool.sheet) {
      setSheet(tool.sheet);
      setOpen(true);
      setIdleBar(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "a-toolbox",
        open && "a-toolbox-open",
        sheet && "a-toolbox-sheet-open",
        idleBar && !open && !sheet && "a-toolbox-idle",
      )}
      onMouseEnter={() => {
        if (idleBar) {
          setIdleBar(false);
          clearIdleTimer();
        }
        openMenu();
      }}
      onMouseLeave={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        if (!sheetRef.current) scheduleClose();
      }}
    >
      <div className="a-toolbox-hit" aria-hidden />
      <div className="a-toolbox-fan" aria-hidden />

      {sheet === "calculator" ? (
        <MiniCalculator
          onClose={() => {
            setSheet(null);
            bumpActivity();
          }}
        />
      ) : null}
      {sheet === "notes" ? (
        <MiniNotes
          onClose={() => {
            setSheet(null);
            bumpActivity();
          }}
        />
      ) : null}

      <ul id={listId} className="a-toolbox-arc" aria-hidden={!open}>
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const label = t(tool.labelKey);
          const { x, y } = arc[index]!;
          const style = {
            "--a-toolbox-i": String(index),
            "--a-toolbox-x": `${x}px`,
            "--a-toolbox-y": `${y}px`,
          } as CSSProperties;

          return (
            <li key={tool.id} className="a-toolbox-item" style={style}>
              <button
                type="button"
                className="a-toolbox-row"
                tabIndex={open ? 0 : -1}
                title={label}
                aria-label={label}
                onMouseEnter={openMenu}
                onClick={() => runTool(tool)}
              >
                <span className="a-toolbox-glyph">
                  <Icon
                    className="h-5 w-5 text-a-accent"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
                <span className="a-toolbox-tip">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="a-toolbox-fab a-toolbox-fab-bar-only"
        aria-label={
          idleBar
            ? t("toolboxExpand")
            : open
              ? t("toolboxClose")
              : t("toolboxOpen")
        }
        aria-expanded={open}
        aria-controls={listId}
        onMouseEnter={() => {
          setIdleBar(false);
          clearIdleTimer();
          openMenu();
        }}
        onFocus={() => {
          setIdleBar(false);
          clearIdleTimer();
          openMenu();
        }}
        onClick={(e) => {
          if (sheet) {
            setSheet(null);
            bumpActivity();
            return;
          }
          if (idleBar) {
            setIdleBar(false);
            setOpen(true);
            return;
          }
          const coarse =
            typeof window !== "undefined" &&
            window.matchMedia("(pointer: coarse)").matches;
          if (coarse) {
            setOpen((v) => !v);
            if (open) bumpActivity();
            return;
          }
          e.preventDefault();
          setOpen(true);
        }}
      >
        <span className="a-toolbox-fab-bar" aria-hidden />
      </button>
    </div>
  );
}

function MiniCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<"+" | "-" | "*" | "/" | null>(null);
  const [fresh, setFresh] = useState(true);
  const [unlockFlash, setUnlockFlash] = useState(false);
  const { t } = useShellT();
  const anyOps = useShellStore(
    (s) => s.spectreEnabled || s.patchEnabled || s.ghostEnabled,
  );

  function tryOpsUnlock(value: string) {
    const shell = useShellStore.getState();
    if (!shell.anyOpsMode()) return;
    const code = usePrefsStore.getState().opsUnlockCode;
    const digits = value.replace(/\D/g, "");
    if (!code || digits !== code) return;
    shell.clearOpsModes();
    setUnlockFlash(true);
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
    window.setTimeout(() => setUnlockFlash(false), 1600);
  }

  function inputDigit(d: string) {
    setDisplay((cur) => {
      const next = fresh || cur === "0" ? d : cur.length >= 14 ? cur : cur + d;
      queueMicrotask(() => tryOpsUnlock(next));
      return next;
    });
    setFresh(false);
  }

  function inputDot() {
    setDisplay((cur) => {
      if (fresh) return "0.";
      if (cur.includes(".")) return cur;
      return cur + ".";
    });
    setFresh(false);
  }

  function clearAll() {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  function applyOp(next: "+" | "-" | "*" | "/") {
    const n = Number.parseFloat(display);
    if (acc == null || op == null || fresh) {
      setAcc(n);
    } else {
      const r = compute(acc, n, op);
      setAcc(r);
      setDisplay(formatNum(r));
    }
    setOp(next);
    setFresh(true);
  }

  function equals() {
    tryOpsUnlock(display);
    if (acc == null || op == null) return;
    const n = Number.parseFloat(display);
    const r = compute(acc, n, op);
    setDisplay(formatNum(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  const keys = [
    ["C", "±", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["0", ".", "="],
  ] as const;

  function onKey(k: string) {
    if (k >= "0" && k <= "9") inputDigit(k);
    else if (k === ".") inputDot();
    else if (k === "C") clearAll();
    else if (k === "=") equals();
    else if (k === "+") applyOp("+");
    else if (k === "−" || k === "-") applyOp("-");
    else if (k === "×" || k === "*") applyOp("*");
    else if (k === "÷" || k === "/") applyOp("/");
    else if (k === "±")
      setDisplay((cur) => formatNum(Number.parseFloat(cur) * -1));
    else if (k === "%")
      setDisplay((cur) => formatNum(Number.parseFloat(cur) / 100));
  }

  return (
    <div className="a-toolbox-sheet" role="dialog" aria-label="Calculatrice">
      <header className="a-toolbox-sheet-head">
        <span>Calculatrice</span>
        <button type="button" onClick={onClose} aria-label="Fermer">
          Fermer
        </button>
      </header>
      {unlockFlash ? (
        <p className="px-3 pb-1 text-center text-[11px] font-medium text-a-success-fg">
          {t("unlockSuccess")}
        </p>
      ) : anyOps ? (
        <p className="px-3 pb-1 text-center text-[10px] text-a-fg-subtle">
          {t("modeLockedHint")}
        </p>
      ) : null}
      <p className="a-toolbox-calc-display a-mono" aria-live="polite">
        {display}
      </p>
      <div className="a-toolbox-calc-pad">
        {keys.flat().map((k) => (
          <button
            key={k}
            type="button"
            className={cn(
              "a-toolbox-calc-key",
              (k === "÷" || k === "×" || k === "−" || k === "+" || k === "=") &&
                "a-toolbox-calc-op",
              k === "0" && "a-toolbox-calc-zero",
              (k === "C" || k === "±" || k === "%") && "a-toolbox-calc-fn",
            )}
            onClick={() => onKey(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniNotes({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("authority-toolbox-notes") ?? "";
  });

  useEffect(() => {
    window.localStorage.setItem("authority-toolbox-notes", text);
  }, [text]);

  return (
    <div className="a-toolbox-sheet" role="dialog" aria-label="Notes">
      <header className="a-toolbox-sheet-head">
        <span>Notes</span>
        <button type="button" onClick={onClose} aria-label="Fermer">
          Fermer
        </button>
      </header>
      <textarea
        className="a-toolbox-notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Mémo rapide…"
        rows={8}
      />
    </div>
  );
}

function compute(a: number, b: number, op: "+" | "-" | "*" | "/"): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
  }
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "Erreur";
  const s = String(Number(n.toPrecision(12)));
  return s.length > 14 ? n.toExponential(6) : s;
}

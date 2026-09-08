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
  CloudSun,
  Languages,
  LayoutGrid,
  MapPinned,
  NotebookPen,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolTone = "accent" | "violet" | "orange" | "sky" | "neutral";

type ToolDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: ToolTone;
  url?: string;
  sheet?: "calculator" | "notes";
};

const TOOLS: ToolDef[] = [
  {
    id: "calc",
    label: "Calculatrice",
    icon: Calculator,
    tone: "orange",
    sheet: "calculator",
  },
  {
    id: "calendar",
    label: "Calendrier",
    icon: CalendarDays,
    tone: "accent",
    url: "https://calendar.google.com/calendar/u/0/r",
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: NotebookPen,
    tone: "violet",
    url: "https://calendar.google.com/calendar/u/0/r/agenda",
  },
  {
    id: "translate",
    label: "Traducteur Google",
    icon: Languages,
    tone: "sky",
    url: "https://translate.google.com/?sl=auto&tl=fr",
  },
  {
    id: "maps",
    label: "Plans",
    icon: MapPinned,
    tone: "accent",
    url: "https://maps.google.com/",
  },
  {
    id: "weather",
    label: "Météo",
    icon: CloudSun,
    tone: "orange",
    url: "https://www.google.com/search?q=m%C3%A9t%C3%A9o",
  },
  {
    id: "notes",
    label: "Notes",
    icon: StickyNote,
    tone: "neutral",
    sheet: "notes",
  },
];

/** Half-circle from left (π) to up (π/2), opening toward the canvas. */
function arcOffset(index: number, total: number, radiusPx: number) {
  const start = Math.PI; // 180°
  const end = Math.PI * 0.48; // ~86°
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const angle = start + (end - start) * t;
  return {
    x: Math.cos(angle) * radiusPx,
    y: -Math.sin(angle) * radiusPx,
  };
}

/**
 * Floating iOS utility toolbox — semicircle fan, outline icons, no chrome frames.
 */
export function FloatingToolbox() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<"calculator" | "notes" | null>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<"calculator" | "notes" | null>(null);
  sheetRef.current = sheet;

  const arc = useMemo(
    () => TOOLS.map((_, i) => arcOffset(i, TOOLS.length, 108)),
    [],
  );

  function clearLeaveTimer() {
    if (leaveTimer.current != null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function openMenu() {
    clearLeaveTimer();
    setOpen(true);
  }

  function scheduleClose() {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      if (!sheetRef.current) setOpen(false);
    }, 420);
  }

  useEffect(() => () => clearLeaveTimer(), []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        clearLeaveTimer();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function runTool(tool: ToolDef) {
    if (tool.url) {
      window.open(tool.url, "_blank", "noopener,noreferrer");
      setOpen(false);
      return;
    }
    if (tool.sheet) {
      setSheet(tool.sheet);
      setOpen(true);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "a-toolbox",
        open && "a-toolbox-open",
        sheet && "a-toolbox-sheet-open",
      )}
      onMouseEnter={openMenu}
      onMouseLeave={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        if (!sheetRef.current) scheduleClose();
      }}
    >
      <div className="a-toolbox-hit" aria-hidden />

      {sheet === "calculator" ? (
        <MiniCalculator onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "notes" ? (
        <MiniNotes onClose={() => setSheet(null)} />
      ) : null}

      <ul id={listId} className="a-toolbox-arc" aria-hidden={!open}>
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
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
                title={tool.label}
                aria-label={tool.label}
                onMouseEnter={openMenu}
                onClick={() => runTool(tool)}
              >
                <span className="a-toolbox-tip">{tool.label}</span>
                <span
                  className={cn("a-toolbox-glyph", `a-toolbox-tone-${tool.tone}`)}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.25} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="a-toolbox-fab"
        aria-label={open ? "Fermer la boîte à outils" : "Boîte à outils"}
        aria-expanded={open}
        aria-controls={listId}
        onMouseEnter={openMenu}
        onFocus={openMenu}
        onClick={(e) => {
          if (sheet) {
            setSheet(null);
            return;
          }
          // Touch: toggle. Desktop hover already opens — don't close on the same click.
          const coarse =
            typeof window !== "undefined" &&
            window.matchMedia("(pointer: coarse)").matches;
          if (coarse) {
            setOpen((v) => !v);
            return;
          }
          e.preventDefault();
          setOpen(true);
        }}
      >
        <span className="a-toolbox-fab-glow" aria-hidden />
        <LayoutGrid
          className="a-toolbox-fab-icon h-5 w-5"
          strokeWidth={1.25}
        />
      </button>
    </div>
  );
}

function MiniCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<"+" | "-" | "*" | "/" | null>(null);
  const [fresh, setFresh] = useState(true);

  function inputDigit(d: string) {
    setDisplay((cur) => {
      if (fresh || cur === "0") return d;
      if (cur.length >= 14) return cur;
      return cur + d;
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

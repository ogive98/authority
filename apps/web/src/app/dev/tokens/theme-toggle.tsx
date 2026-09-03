"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      "dark";
    setTheme(current);
  }, []);

  function apply(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  return (
    <div
      className="inline-flex rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 p-1"
      role="group"
      aria-label="Thème"
    >
      {(["dark", "light"] as const).map((t) => {
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => apply(t)}
            className="rounded-[calc(var(--a-radius-md)-2px)] px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium capitalize"
            style={{
              background: active ? "var(--a-accent)" : "transparent",
              color: active ? "var(--a-accent-fg)" : "var(--a-fg-muted)",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

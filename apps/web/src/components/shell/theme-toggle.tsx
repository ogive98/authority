"use client";

import { useEffect, useState } from "react";
import { ThemeModeSwitch } from "./mode-switch";

/** Dev pages theme control — same iOS switch as shell. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "dark"
        | "light"
        | null) ?? "dark";
    setTheme(current);
  }, []);

  function apply(next: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  return <ThemeModeSwitch theme={theme} onThemeChange={apply} />;
}

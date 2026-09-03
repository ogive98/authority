"use client";

import {
  Eye,
  Moon,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ASwitch } from "@/components/a/a-switch";
import { cn } from "@/lib/utils";

type ModeSwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  icon: LucideIcon;
  className?: string;
};

/** Icon + iOS switch — SPECTRE, PATCH, theme, future modes. */
export function ModeSwitch({
  label,
  checked,
  onCheckedChange,
  icon: Icon,
  className,
}: ModeSwitchProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      title={label}
    >
      <Icon
        className="h-4 w-4 text-a-fg-muted"
        strokeWidth={1.75}
        aria-hidden
      />
      <ASwitch
        size="sm"
        label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function ThemeModeSwitch({
  theme,
  onThemeChange,
}: {
  theme: "dark" | "light";
  onThemeChange: (t: "dark" | "light") => void;
}) {
  const isDark = theme === "dark";
  return (
    <div className="inline-flex items-center gap-2" title="Thème">
      <Sun className="h-4 w-4 text-a-fg-muted" strokeWidth={1.75} aria-hidden />
      <ASwitch
        size="sm"
        label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
        checked={isDark}
        onCheckedChange={(dark) => onThemeChange(dark ? "dark" : "light")}
      />
      <Moon className="h-4 w-4 text-a-fg-muted" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

export { Eye as SpectreIcon, Wrench as PatchIcon };

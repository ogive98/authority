"use client";

import { useMemo } from "react";
import { useLocaleStore, type ShellLocale } from "@/stores/locale-store";
import { statusLabel, statusLabelsMap } from "@/lib/i18n/status-labels";

export function useStatusLabel() {
  const locale = useLocaleStore((s) => s.locale);
  return useMemo(
    () => ({
      locale,
      label: (key: string, fallback?: string) =>
        statusLabel(key, locale, fallback),
      map: statusLabelsMap(locale) as Record<string, string>,
    }),
    [locale],
  );
}

export function useShellLocale(): ShellLocale {
  return useLocaleStore((s) => s.locale);
}

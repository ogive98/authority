import type { ShellLocale } from "@/stores/locale-store";

/** Command group labels — no import from command-catalog (avoid cycles). */
export type CommandGroupIdI18n =
  | "navigation"
  | "search"
  | "actions"
  | "settings";

export const COMMAND_GROUP_LABELS_I18N: Record<
  ShellLocale,
  Record<CommandGroupIdI18n, string>
> = {
  fr: {
    navigation: "Navigation",
    search: "Recherche",
    actions: "Actions",
    settings: "Paramètres",
  },
  it: {
    navigation: "Navigazione",
    search: "Ricerca",
    actions: "Azioni",
    settings: "Impostazioni",
  },
};

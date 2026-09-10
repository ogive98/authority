"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ShellLocale = "fr" | "it";

type LocaleState = {
  locale: ShellLocale;
  setLocale: (locale: ShellLocale) => void;
  toggleLocale: () => void;
  applyLocaleToDom: (locale: ShellLocale) => void;
};

function writeLangAttr(locale: ShellLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", locale);
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: "fr",
      setLocale: (locale) => {
        writeLangAttr(locale);
        set({ locale });
      },
      toggleLocale: () => {
        const next = get().locale === "fr" ? "it" : "fr";
        writeLangAttr(next);
        set({ locale: next });
      },
      applyLocaleToDom: writeLangAttr,
    }),
    {
      name: "authority-locale",
      onRehydrateStorage: () => (state) => {
        if (state?.locale) writeLangAttr(state.locale);
      },
    },
  ),
);

/** Shell chrome strings — FR / IT (D162). Module labels stay registry-driven. */
const SHELL_I18N = {
  fr: {
    searchPlaceholder: "Rechercher une commande, un module, une information…",
    searchAria: "Rechercher (⌘K)",
    notifications: "Notifications",
    notificationsUnread: (n: number) =>
      `Notifications — ${n} non lu${n > 1 ? "s" : ""}`,
    theme: "Thème",
    themeToLight: "Passer en mode clair",
    themeToDark: "Passer en mode sombre",
    langToggle: "Langue — basculer français / italiano",
    spectreEnter: "Activer SPECTRE MODE",
    patchEnter: "Activer PATCH MODE",
    ghostEnter: "Activer GHOST MODE",
    modeLockedHint:
      "Mode actif — tapez le code de sortie sur la calculatrice (outils)",
    smartActions: "Smart Actions",
    primary: "Principal",
    shortcuts: "Raccourcis",
    system: "État du système",
    resources: "Ressources",
    surface: "Surface",
    density: "Densité",
    commandCenter: "Command Center",
    preferences: "Préférences",
    expandDock: "Développer le dock",
    collapseDock: "Réduire le dock",
    expandNav: "Étendre la navigation",
    collapseNav: "Réduire la navigation",
    help: "Aide",
    logout: "Déconnexion",
    modules: "Modules",
    systemSection: "Système",
    online: "En ligne",
    snapshotUnavailable: "Snapshot indisponible",
    loading: "Chargement…",
    kpiEmpty: "Données dès API",
    kpiRevenue: "Chiffre d’affaires",
    kpiOrders: "Commandes",
    kpiStock: "Stock global",
    kpiEfficiency: "Efficacité opérationnelle",
    allClear: "Tout fonctionne",
    missionControl: "Mission Control",
    controlCenter: "Control Center",
    aiDisabled: "DISABLED",
    unlockSuccess: "Modes ops désactivés",
    unlockCodeLabel: "Code sortie modes (calculatrice)",
    unlockCodeHint:
      "SPECTRE / PATCH / GHOST se quittent en saisissant ce code sur la calculatrice du toolbox. Réservé Admin / Super Admin.",
  },
  it: {
    searchPlaceholder: "Cerca un ordine, un modulo, un’informazione…",
    searchAria: "Cerca (⌘K)",
    notifications: "Notifiche",
    notificationsUnread: (n: number) =>
      `Notifiche — ${n} non lett${n > 1 ? "e" : "a"}`,
    theme: "Tema",
    themeToLight: "Passa alla modalità chiara",
    themeToDark: "Passa alla modalità scura",
    langToggle: "Lingua — cambia francese / italiano",
    spectreEnter: "Attiva SPECTRE MODE",
    patchEnter: "Attiva PATCH MODE",
    ghostEnter: "Attiva GHOST MODE",
    modeLockedHint:
      "Modalità attiva — digita il codice di uscita sulla calcolatrice (toolbox)",
    smartActions: "Smart Actions",
    primary: "Principale",
    shortcuts: "Scorciatoie",
    system: "Stato del sistema",
    resources: "Risorse",
    surface: "Superficie",
    density: "Densità",
    commandCenter: "Command Center",
    preferences: "Preferenze",
    expandDock: "Espandi il dock",
    collapseDock: "Comprimi il dock",
    expandNav: "Espandi navigazione",
    collapseNav: "Comprimi navigazione",
    help: "Aiuto",
    logout: "Esci",
    modules: "Moduli",
    systemSection: "Sistema",
    online: "Online",
    snapshotUnavailable: "Snapshot non disponibile",
    loading: "Caricamento…",
    kpiEmpty: "Dati dall’API",
    kpiRevenue: "Fatturato",
    kpiOrders: "Ordini",
    kpiStock: "Scorte globali",
    kpiEfficiency: "Efficienza operativa",
    allClear: "Tutto operativo",
    missionControl: "Mission Control",
    controlCenter: "Control Center",
    aiDisabled: "DISABLED",
    unlockSuccess: "Modalità ops disattivate",
    unlockCodeLabel: "Codice uscita modalità (calcolatrice)",
    unlockCodeHint:
      "SPECTRE / PATCH / GHOST si escono digitando questo codice sulla calcolatrice del toolbox. Solo Admin / Super Admin.",
  },
} as const;

export type ShellMessageKey = Exclude<
  keyof (typeof SHELL_I18N)["fr"],
  "notificationsUnread"
>;

export function useShellT() {
  const locale = useLocaleStore((s) => s.locale);
  const dict = SHELL_I18N[locale];
  return {
    locale,
    t: (key: ShellMessageKey) => dict[key] as string,
    unread: (n: number) => dict.notificationsUnread(n),
  };
}

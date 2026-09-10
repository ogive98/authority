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
    kpiArOpen: "Créances ouvertes",
    kpiOrders: "Commandes actives",
    kpiStock: "Stock disponible",
    kpiOverdue: "Créances échues",
    kpiModuleOff: "Module inactif",
    kpiForbidden: "Permission refusée",
    kpiUnavailable: "Indisponible",
    commandPalettePlaceholder: "Que cherchez-vous ?",
    allClear: "Tout fonctionne",
    missionControl: "Mission Control",
    controlCenter: "Control Center",
    aiDisabled: "DISABLED",
    unlockSuccess: "Modes ops désactivés",
    unlockCodeLabel: "Code sortie modes (calculatrice)",
    unlockCodeHint:
      "SPECTRE / PATCH / GHOST se quittent en saisissant ce code sur la calculatrice du toolbox. Réservé Admin / Super Admin.",
    greetMorning: "Bonjour",
    greetAfternoon: "Bon après-midi",
    greetEvening: "Bonsoir",
    accountFallback: "Compte",
    operatorFallback: "Opérateur",
    tipPrefix: "Astuce",
    featuresPrefix: "Features",
    tasksClear: "Tout est traité",
    tasksClearHint:
      "Aucune tâche en file pour ce poste. Les workflows métier arriveront via le registry actions.",
    activityEmpty: "Aucune activité récente.",
    activityUpToDate: "À jour",
    aiAssistant: "Assistant IA",
    aiDisabledHint: "optionnel, jamais une dépendance runtime.",
    snapshotNone: "Snapshot indisponible. Aucune métrique inventée.",
    wifiScanning: "Recherche réseau…",
    wifiOnline: "Réseau",
    wifiOffline: "Hors réseau",
    syncIdle: "Sync",
    syncActive: "Sync en cours",
    thunderCore: "Thunder Core",
    thunderCoreOpen: "Paramétrage Thunder Core",
    thunderCoreHint: "Surface, densité et préférences plateforme.",
    toolboxOpen: "Boîte à outils",
    toolboxClose: "Fermer la boîte à outils",
    toolboxExpand: "Outils — étendre",
    toolCalc: "Calculatrice",
    toolCalendar: "Calendrier",
    toolAgenda: "Agenda",
    toolTranslate: "Traducteur",
    toolNotes: "Notes",
    close: "Fermer",
    kpiOrdersDraft: "Brouillons",
    kpiOrdersConfirmed: "Confirmées",
    kpiStockBalances: "Lignes stock",
    kpiStockLots: "Lots ouverts",
    kpiShipmentsActive: "Livraisons actives",
    kpiShipmentsReady: "Prêtes",
    kpiShipmentsOut: "En route / assignées",
    kpiModuleFeatures: "Module",
    kpiEmptyModule: "Pas d’indicateurs numériques pour ce module",
    widgetShellStatus: "État plateforme",
    widgetTasks: "Tâches",
    widgetShortcuts: "Raccourcis module",
    widgetActivity: "Activité",
    widgetAi: "Assistant IA",
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
    kpiArOpen: "Crediti aperti",
    kpiOrders: "Ordini attivi",
    kpiStock: "Scorte disponibili",
    kpiOverdue: "Crediti scaduti",
    kpiModuleOff: "Modulo inattivo",
    kpiForbidden: "Permesso negato",
    kpiUnavailable: "Non disponibile",
    commandPalettePlaceholder: "Cosa stai cercando?",
    allClear: "Tutto operativo",
    missionControl: "Mission Control",
    controlCenter: "Control Center",
    aiDisabled: "DISABLED",
    unlockSuccess: "Modalità ops disattivate",
    unlockCodeLabel: "Codice uscita modalità (calcolatrice)",
    unlockCodeHint:
      "SPECTRE / PATCH / GHOST si escono digitando questo codice sulla calcolatrice del toolbox. Solo Admin / Super Admin.",
    greetMorning: "Buongiorno",
    greetAfternoon: "Buon pomeriggio",
    greetEvening: "Buonasera",
    accountFallback: "Account",
    operatorFallback: "Operatore",
    tipPrefix: "Suggerimento",
    featuresPrefix: "Funzioni",
    tasksClear: "Tutto elaborato",
    tasksClearHint:
      "Nessuna attività in coda per questa postazione. I workflow arriveranno via registry actions.",
    activityEmpty: "Nessuna attività recente.",
    activityUpToDate: "Aggiornato",
    aiAssistant: "Assistente IA",
    aiDisabledHint: "opzionale, mai una dipendenza runtime.",
    snapshotNone: "Snapshot non disponibile. Nessuna metrica inventata.",
    wifiScanning: "Ricerca rete…",
    wifiOnline: "Rete",
    wifiOffline: "Fuori rete",
    syncIdle: "Sync",
    syncActive: "Sync in corso",
    thunderCore: "Thunder Core",
    thunderCoreOpen: "Impostazioni Thunder Core",
    thunderCoreHint: "Superficie, densità e preferenze piattaforma.",
    toolboxOpen: "Cassetta degli attrezzi",
    toolboxClose: "Chiudi cassetta degli attrezzi",
    toolboxExpand: "Strumenti — espandi",
    toolCalc: "Calcolatrice",
    toolCalendar: "Calendario",
    toolAgenda: "Agenda",
    toolTranslate: "Traduttore",
    toolNotes: "Note",
    close: "Chiudi",
    kpiOrdersDraft: "Bozze",
    kpiOrdersConfirmed: "Confermati",
    kpiStockBalances: "Righe scorte",
    kpiStockLots: "Lotti aperti",
    kpiShipmentsActive: "Consegne attive",
    kpiShipmentsReady: "Pronti",
    kpiShipmentsOut: "In corso / assegnati",
    kpiModuleFeatures: "Modulo",
    kpiEmptyModule: "Nessun indicatore numerico per questo modulo",
    widgetShellStatus: "Stato piattaforma",
    widgetTasks: "Attività",
    widgetShortcuts: "Scorciatoie modulo",
    widgetActivity: "Attività recente",
    widgetAi: "Assistente IA",
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

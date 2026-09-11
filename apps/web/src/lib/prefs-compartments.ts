/**
 * Préférences Soft Glass — rail compartiments (D203 lock 1C).
 * Sous-titres only · zero frames.
 */

export type PrefsCompartmentId =
  | "poste"
  | "societe"
  | "modes"
  | "expertise"
  | "envois"
  | "finance"
  | "comptabilite"
  | "ventes"
  | "roles";

export type PrefsCompartmentDef = {
  id: PrefsCompartmentId;
  label: string;
  subtitle: string;
  /** Requires settings.company.write */
  adminOnly?: boolean;
  /** Super Admin membership required to write (Rôles). */
  superAdminWrite?: boolean;
};

export const PREFS_COMPARTMENTS: readonly PrefsCompartmentDef[] = [
  {
    id: "poste",
    label: "Poste",
    subtitle: "Densité, matériau Soft Glass, sidebar, notifications",
  },
  {
    id: "societe",
    label: "Société",
    subtitle: "Contexte société (fuseau, devise, sites)",
  },
  {
    id: "modes",
    label: "Modes ops",
    subtitle: "PATCH · GHOST · code calculatrice (SPECTRE inchangé)",
    adminOnly: true,
  },
  {
    id: "expertise",
    label: "Expertise légale",
    subtitle: "FODEC, timbre, CNSS, IRPP, abattements, TFP",
    adminOnly: true,
  },
  {
    id: "envois",
    label: "Envois",
    subtitle: "Invitations, SMTP, Relances WA / Meta",
    adminOnly: true,
  },
  {
    id: "finance",
    label: "Finance",
    subtitle: "Jalons recouvrement, pression crédit",
    adminOnly: true,
  },
  {
    id: "comptabilite",
    label: "Comptabilité",
    subtitle: "Mapping Finance → GL",
    adminOnly: true,
  },
  {
    id: "ventes",
    label: "Ventes & stock",
    subtitle: "Préférences modules ventes / inventaire",
    adminOnly: true,
  },
  {
    id: "roles",
    label: "Rôles",
    subtitle: "Overrides ops / features par rôle (Super Admin)",
    adminOnly: true,
    superAdminWrite: true,
  },
] as const;

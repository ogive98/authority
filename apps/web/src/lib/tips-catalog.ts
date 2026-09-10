/**
 * Documented usage tips — AUTHORITY Contiental Apple.
 * Each tip links to Help / User Guide / a métier screen.
 */

export type TipAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "palette"; label: string }
  | { kind: "spectre"; label: string }
  | { kind: "patch"; label: string };

export type UsageTip = {
  id: string;
  /** Routes where this tip is most relevant (prefix match). Empty = global. */
  routes: string[];
  /** Module keys (sidebar) that also surface the tip on `/`. */
  modules: string[];
  title: string;
  body: string;
  shortcut?: string;
  category:
    | "navigation"
    | "finance"
    | "stock"
    | "ops"
    | "legal"
    | "a11y"
    | "guide";
  action: TipAction;
};

export const USAGE_TIPS: UsageTip[] = [
  // —— Navigation / shell ——
  {
    id: "nav-cmdk",
    routes: ["/", "/help"],
    modules: ["home"],
    title: "La loupe ouvre un Spotlight — pas une barre permanente",
    body: "Cliquez la loupe en haut (ou ⌘K) : une fenêtre flottante type Spotlight apparaît au centre. Tapez un module, une facture ou une action. Flèches pour choisir, Entrée pour ouvrir, Esc pour fermer. Rien n’encombre la topbar en permanence.",
    shortcut: "⌘K",
    category: "navigation",
    action: { kind: "palette", label: "Ouvrir la palette" },
  },
  {
    id: "nav-module-click",
    routes: ["/"],
    modules: ["home"],
    title: "Un clic module = liste métier",
    body: "La sidebar liste seulement les modules (icône outline + nom). Un clic sélectionne le module et affiche ses fonctionnalités en liste dense sur l’accueil — Contiental, sans grille d’icônes sous-module. Pas de sous-menus dans la sidebar.",
    category: "navigation",
    action: { kind: "link", href: "/help#modules", label: "Guide modules" },
  },
  {
    id: "nav-help",
    routes: ["/", "/settings"],
    modules: ["home", "settings"],
    title: "Chaque teaser se termine dans l’aide",
    body: "Sous chaque page, les astuces sont des têtes longues : une fonctionnalité expliquée en quelques phrases, puis « Continuer dans l’aide » pour la fiche complète, les raccourcis et le User Guide fromagerie.",
    shortcut: "?",
    category: "guide",
    action: { kind: "link", href: "/help", label: "Ouvrir l’aide" },
  },
  {
    id: "nav-guide",
    routes: ["/help"],
    modules: [],
    title: "User Guide bout-en-bout",
    body: "Une seule page pour le parcours métier : ventes → stock → livraison → facture, avec les garde-fous légaux Tunisie (TVA, Expertise FODEC/timbre). Ideal pour onboarding opérateur.",
    category: "guide",
    action: { kind: "link", href: "/help/guide", label: "Lire le guide" },
  },
  {
    id: "nav-breadcrumbs",
    routes: ["/finance", "/sales", "/inventory", "/delivery"],
    modules: [],
    title: "Fil d’Ariane vers le Launchpad",
    body: "Sur les écrans métier, le fil Accueil › … remonte au Launchpad du module sans perdre la sélection sidebar. Utile après une plongée facture / BL / OF.",
    category: "navigation",
    action: { kind: "link", href: "/", label: "Retour Launchpad" },
  },
  {
    id: "nav-sidebar-collapse",
    routes: ["/"],
    modules: ["home"],
    title: "Sidebar compacte = rail Finder",
    body: "Le bouton panneau (dans la sidebar uniquement) réduit la liste à un rail d’icônes outline. La topbar — logo, loupe, SPECTRE — ne bouge pas : elle reste indépendante du collapse.",
    category: "navigation",
    action: { kind: "link", href: "/help#sidebar", label: "Voir sidebar" },
  },

  // —— Ops / SPECTRE ——
  {
    id: "ops-spectre",
    routes: ["/", "/finance", "/hr", "/settings"],
    modules: ["home", "finance", "hr"],
    title: "SPECTRE masque l’écran, pas les droits",
    body: "Avant une démo client ou un audit en salle, activez SPECTRE dans la toolbar. Salaires, PII et montants sensibles sont floutés / masqués à l’affichage. Les permissions API restent inchangées — ce n’est pas un bypass Super Admin.",
    category: "ops",
    action: { kind: "spectre", label: "Activer SPECTRE" },
  },
  {
    id: "ops-patch",
    routes: ["/", "/repair"],
    modules: ["home", "repair"],
    title: "PATCH = intervention contrôlée",
    body: "PATCH signale une fenêtre d’ops technique (repair / maintenance). Visible dans la toolbar, il ne remplace pas les permissions métier. Utilisez-le seulement pendant une intervention validée.",
    category: "ops",
    action: { kind: "patch", label: "Activer PATCH" },
  },
  {
    id: "ops-theme",
    routes: ["/", "/settings"],
    modules: ["home", "settings"],
    title: "Thème clair / sombre Apple",
    body: "L’icône lune / soleil bascule les matériaux vibrancy (#f5f5f7 ↔ #1c1c1e). Le logo société s’inverse automatiquement (encre noire ↔ blanche) pour rester lisible.",
    category: "a11y",
    action: { kind: "link", href: "/help#theme", label: "Aide thème" },
  },

  // —— Finance ——
  {
    id: "fin-invoices",
    routes: ["/finance", "/finance/invoices"],
    modules: ["finance"],
    title: "Factures HT / TVA / TTC",
    body: "La TVA vient du Tax Engine ; FODEC/timbre seulement si expertise VALIDATED.",
    category: "finance",
    action: {
      kind: "link",
      href: "/finance/invoices",
      label: "Ouvrir factures",
    },
  },
  {
    id: "fin-fodec",
    routes: ["/finance/invoices", "/settings"],
    modules: ["finance", "settings"],
    title: "FODEC & timbre",
    body: "Saisissez les taux en Préférences › Expertise — jamais inventés par le code.",
    category: "legal",
    action: {
      kind: "link",
      href: "/settings#expertise",
      label: "Expertise légale",
    },
  },
  {
    id: "fin-promises",
    routes: ["/finance", "/finance/promises"],
    modules: ["finance"],
    title: "Promesses de paiement",
    body: "Une promesse OPEN par créance ; passage KEPT à la clôture, BROKEN en retard.",
    category: "finance",
    action: {
      kind: "link",
      href: "/finance/promises",
      label: "Voir promesses",
    },
  },
  {
    id: "fin-payments",
    routes: ["/finance/payments"],
    modules: ["finance"],
    title: "Encaissements",
    body: "Rattachez un paiement à une créance ouverte — traçabilité Thunder.",
    category: "finance",
    action: {
      kind: "link",
      href: "/help/guide#finance",
      label: "Guide finance",
    },
  },
  {
    id: "fin-instruments",
    routes: ["/finance/instruments"],
    modules: ["finance"],
    title: "Instruments",
    body: "Chèques / effets : suivez le cycle sans contourner le ledger.",
    category: "finance",
    action: {
      kind: "link",
      href: "/finance/instruments",
      label: "Instruments",
    },
  },
  {
    id: "fin-open-items",
    routes: ["/finance"],
    modules: ["finance"],
    title: "Créances ouvertes",
    body: "Priorisez les âges de solde ; créez une promesse depuis la ligne.",
    category: "finance",
    action: { kind: "link", href: "/finance", label: "Créances" },
  },

  // —— Tax / legal ——
  {
    id: "tax-catalog",
    routes: ["/tax"],
    modules: ["tax"],
    title: "Catalogue TVA Tunisie",
    body: "Codes 7 / 13 / 19 / 0 — référence légale affichée, pas de taux inventés.",
    category: "legal",
    action: { kind: "link", href: "/tax", label: "Fiscalité" },
  },
  {
    id: "tax-vs-expertise",
    routes: ["/tax", "/settings"],
    modules: ["tax", "settings"],
    title: "TVA vs Préférences",
    body: "TVA = Tax Engine. FODEC / timbre / CNSS / IRPP = sièges Expertise.",
    category: "legal",
    action: {
      kind: "link",
      href: "/help/guide#legal",
      label: "Guide légal",
    },
  },

  // —— HR ——
  {
    id: "hr-employees",
    routes: ["/hr"],
    modules: ["hr"],
    title: "Employés & contrats",
    body: "RH light : fiches + contrats. Pas de barèmes CNSS/IRPP tant que PENDING.",
    category: "legal",
    action: { kind: "link", href: "/hr", label: "Ressources humaines" },
  },
  {
    id: "hr-wage-mask",
    routes: ["/hr"],
    modules: ["hr"],
    title: "Masquage salaire",
    body: "Permission `hr.wage.read` + SPECTRE pour ne jamais exposer le wageRef.",
    category: "ops",
    action: { kind: "spectre", label: "Activer SPECTRE" },
  },
  {
    id: "hr-cnss-seat",
    routes: ["/hr", "/settings"],
    modules: ["hr", "settings"],
    title: "Siège CNSS",
    body: "Le taux CNSS se saisit en Expertise — le module RH consomme seulement VALIDATED.",
    category: "legal",
    action: {
      kind: "link",
      href: "/settings#expertise",
      label: "Expertise CNSS",
    },
  },

  // —— Stock / sales / delivery / production ——
  {
    id: "stock-lots",
    routes: ["/preview/lots", "/inventory"],
    modules: ["inventory"],
    title: "Lots & DLC",
    body: "Surveillez les DLC courtes ; les quantités restent tabulaires (jamais floues).",
    category: "stock",
    action: { kind: "link", href: "/preview/lots", label: "Lots" },
  },
  {
    id: "stock-adjust",
    routes: ["/inventory"],
    modules: ["inventory"],
    title: "Ajustement stock",
    body: "Tout mouvement passe par Inventory — production écrit via adjust, pas hors-bande.",
    category: "stock",
    action: {
      kind: "link",
      href: "/help/guide#stock",
      label: "Guide stock",
    },
  },
  {
    id: "sales-orders",
    routes: ["/sales", "/preview/commandes"],
    modules: ["sales"],
    title: "Prise de commande",
    body: "Vérifiez le client et le site avant envoi — idempotency sur confirm.",
    category: "stock",
    action: { kind: "link", href: "/sales", label: "Commandes" },
  },
  {
    id: "sales-customers",
    routes: ["/customers"],
    modules: ["sales"],
    title: "Fiches clients",
    body: "B2B fromagerie : un client = une raison sociale + sites de livraison.",
    category: "stock",
    action: { kind: "link", href: "/customers", label: "Clients" },
  },
  {
    id: "delivery-tours",
    routes: ["/delivery"],
    modules: ["delivery"],
    title: "Tournées",
    body: "Planifiez les tournées après confirmation commande — icône camion = statut route.",
    category: "stock",
    action: { kind: "link", href: "/delivery", label: "Livraison" },
  },
  {
    id: "prod-wo",
    routes: ["/production"],
    modules: ["production"],
    title: "Ordres de fabrication",
    body: "Consommation / sortie / scrap tracés ; stock mis à jour via Inventory.",
    category: "stock",
    action: { kind: "link", href: "/production", label: "Production" },
  },

  // —— Repair ——
  {
    id: "repair-safe",
    routes: ["/repair"],
    modules: ["repair"],
    title: "Repair SAFE / LOW",
    body: "Seuls les scénarios allowlistés s’exécutent — pas de faux rollback.",
    category: "ops",
    action: {
      kind: "link",
      href: "/help/guide#repair",
      label: "Guide Repair",
    },
  },
  {
    id: "repair-audit",
    routes: ["/repair"],
    modules: ["repair"],
    title: "Audit local",
    body: "Chaque exécution laisse une trace outbox — ouvrez le panneau mission.",
    category: "ops",
    action: { kind: "link", href: "/repair", label: "Repair" },
  },

  // —— Settings / a11y ——
  {
    id: "settings-expertise",
    routes: ["/settings"],
    modules: ["settings"],
    title: "Expertise légale",
    body: "Slots PENDING jusqu’à saisie expert (valeur + ref loi + date).",
    category: "legal",
    action: {
      kind: "link",
      href: "/settings#expertise",
      label: "Ouvrir Expertise",
    },
  },
  {
    id: "settings-company",
    routes: ["/settings"],
    modules: ["settings"],
    title: "Contexte société",
    body: "Sans `authority_company_id`, les APIs métier renvoient 403 — fixez le contexte.",
    category: "navigation",
    action: {
      kind: "link",
      href: "/help/guide#context",
      label: "Guide contexte",
    },
  },
  {
    id: "a11y-contrast",
    routes: ["/", "/help"],
    modules: ["home"],
    title: "Accessibilité",
    body: "Focus visible Apple Blue ; skip link clavier uniquement (pas affiché en permanence).",
    category: "a11y",
    action: { kind: "link", href: "/help#a11y", label: "Aide a11y" },
  },
  {
    id: "a11y-tabular",
    routes: ["/finance", "/inventory", "/tax"],
    modules: ["finance", "inventory", "tax"],
    title: "Montants lisibles",
    body: "TND et stocks restent solides (tabular) — jamais floutés hors SPECTRE.",
    category: "a11y",
    action: {
      kind: "link",
      href: "/help/guide#amounts",
      label: "Règle montants",
    },
  },
  {
    id: "guide-journey",
    routes: ["/"],
    modules: ["home"],
    title: "Parcours complet",
    body: "Commande → OF → livraison → facture → encaissement — étapes du User Guide.",
    category: "guide",
    action: { kind: "link", href: "/help/guide", label: "User Guide" },
  },
  {
    id: "guide-shortcuts",
    routes: ["/help", "/help/guide"],
    modules: [],
    title: "Raccourcis",
    body: "⌘K recherche · Aide sidebar · clic module = Launchpad · SPECTRE dans la toolbar.",
    shortcut: "⌘K · ?",
    category: "guide",
    action: { kind: "link", href: "/help#shortcuts", label: "Liste raccourcis" },
  },
  {
    id: "preview-lab",
    routes: ["/preview"],
    modules: ["home"],
    title: "Écrans aperçu",
    body: "Laboratoire UI (lots, commandes) — même chrome Contiental Apple.",
    category: "navigation",
    action: { kind: "link", href: "/preview", label: "Aperçu" },
  },

  // —— Extended pack (rotation / densité) ——
  {
    id: "brand-plate",
    routes: ["/"],
    modules: ["home"],
    title: "Logo société",
    body: "Le rectangle bas de sidebar affiche Fattorie Covelli + Powered by AUTHORITY.",
    category: "navigation",
    action: { kind: "link", href: "/help#brand", label: "Identité" },
  },
  {
    id: "ui-grid-bg",
    routes: ["/"],
    modules: ["home"],
    title: "Fond grille + glass",
    body: "Le canvas combine une grille discrète et des matériaux translucides (sidebar / toolbar).",
    category: "a11y",
    action: { kind: "link", href: "/help#theme", label: "Thème" },
  },
  {
    id: "ui-icon-motion",
    routes: ["/"],
    modules: ["home", "delivery", "production"],
    title: "Animations métier",
    body: "Survolez un module : camion qui roule, usine qui fume, wallet, clé… aussi dans la sidebar.",
    category: "navigation",
    action: { kind: "link", href: "/help#modules", label: "Icônes" },
  },
  {
    id: "fin-ht-tva",
    routes: ["/finance/invoices"],
    modules: ["finance"],
    title: "Lignes de facture",
    body: "Chaque ligne calcule HT, TVA et TTC via le code TVA Tunisie du Tax Engine.",
    category: "finance",
    action: {
      kind: "link",
      href: "/help/guide#finance",
      label: "Guide facture",
    },
  },
  {
    id: "fin-draft-send",
    routes: ["/finance/invoices"],
    modules: ["finance"],
    title: "Brouillon → émise",
    body: "N’émettez qu’après contrôle client / site — actions confirmées avec Idempotency-Key.",
    category: "finance",
    action: {
      kind: "link",
      href: "/finance/invoices",
      label: "Factures",
    },
  },
  {
    id: "fin-ageing",
    routes: ["/finance"],
    modules: ["finance"],
    title: "Âge des créances",
    body: "Triez par ancienneté pour prioriser les relances et les promesses.",
    category: "finance",
    action: { kind: "link", href: "/finance", label: "Créances" },
  },
  {
    id: "fin-promise-broken",
    routes: ["/finance/promises"],
    modules: ["finance"],
    title: "Promesse BROKEN",
    body: "Le statut BROKEN se calcule en retard (lazy) — pas de blocage auto des ventes en V0.",
    category: "finance",
    action: {
      kind: "link",
      href: "/help/guide#finance",
      label: "Règles promesse",
    },
  },
  {
    id: "fin-cheque",
    routes: ["/finance/instruments"],
    modules: ["finance"],
    title: "Chèques & effets",
    body: "Chaque instrument a un cycle d’état — ne contournez jamais le ledger.",
    category: "finance",
    action: {
      kind: "link",
      href: "/finance/instruments",
      label: "Instruments",
    },
  },
  {
    id: "fin-allocate",
    routes: ["/finance/payments"],
    modules: ["finance"],
    title: "Allocation paiement",
    body: "Imputez le paiement sur la bonne créance pour garder le solde ouvert cohérent.",
    category: "finance",
    action: {
      kind: "link",
      href: "/finance/payments",
      label: "Encaissements",
    },
  },
  {
    id: "tax-zero",
    routes: ["/tax"],
    modules: ["tax"],
    title: "Taux 0 %",
    body: "Le code exonéré 0 % existe dans le catalogue — toujours avec lawRef visible.",
    category: "legal",
    action: { kind: "link", href: "/tax", label: "Catalogue TVA" },
  },
  {
    id: "tax-invoice-link",
    routes: ["/tax", "/finance/invoices"],
    modules: ["tax", "finance"],
    title: "TVA sur facture",
    body: "Changer un taux au Tax Engine impacte les nouvelles lignes — pas de rétroactif silencieux.",
    category: "legal",
    action: {
      kind: "link",
      href: "/help/guide#legal",
      label: "Guide légal",
    },
  },
  {
    id: "exp-pending",
    routes: ["/settings"],
    modules: ["settings"],
    title: "Slot PENDING",
    body: "Tant que PENDING, Finance/RH ne consomment pas le taux (valeur null / 0 appliqué).",
    category: "legal",
    action: {
      kind: "link",
      href: "/settings#expertise",
      label: "Expertise",
    },
  },
  {
    id: "exp-validated",
    routes: ["/settings"],
    modules: ["settings"],
    title: "Validation expert",
    body: "VALIDATED exige valueLabel + lawRef + expertValidatedAt — champs vides interdits.",
    category: "legal",
    action: {
      kind: "link",
      href: "/help/guide#legal",
      label: "Règles expertise",
    },
  },
  {
    id: "hr-contract",
    routes: ["/hr"],
    modules: ["hr"],
    title: "Contrats",
    body: "Attachez un contrat à l’employé avant toute lecture wageRef protégée.",
    category: "legal",
    action: { kind: "link", href: "/hr", label: "RH" },
  },
  {
    id: "hr-no-rates",
    routes: ["/hr"],
    modules: ["hr"],
    title: "Pas de barème inventé",
    body: "CNSS / IRPP restent dans Expertise — le module RH light n’embarque aucun taux hardcodé.",
    category: "legal",
    action: {
      kind: "link",
      href: "/settings#expertise",
      label: "Sièges RH",
    },
  },
  {
    id: "stock-dlc",
    routes: ["/preview/lots"],
    modules: ["inventory"],
    title: "Alerte DLC",
    body: "Filtrez les lots < 7 j pour prioriser les sorties fromagerie.",
    category: "stock",
    action: { kind: "link", href: "/preview/lots", label: "Lots" },
  },
  {
    id: "stock-uom",
    routes: ["/inventory"],
    modules: ["inventory"],
    title: "Unités",
    body: "kg / pièces restent tabulaires — SPECTRE ne floute pas le stock opérationnel.",
    category: "stock",
    action: {
      kind: "link",
      href: "/help/guide#amounts",
      label: "Montants & stock",
    },
  },
  {
    id: "sales-confirm",
    routes: ["/sales"],
    modules: ["sales"],
    title: "Confirmation commande",
    body: "Confirm = point de non-retour soft ; utilisez la palette pour retrouver la commande.",
    shortcut: "⌘K",
    category: "stock",
    action: { kind: "palette", label: "Chercher commande" },
  },
  {
    id: "sales-site",
    routes: ["/sales", "/customers"],
    modules: ["sales"],
    title: "Site de livraison",
    body: "Choisissez le site client avant prise de commande — impact tournées.",
    category: "stock",
    action: { kind: "link", href: "/customers", label: "Clients" },
  },
  {
    id: "del-status",
    routes: ["/delivery"],
    modules: ["delivery"],
    title: "Statut tournée",
    body: "Passez planifié → en route → livré ; l’icône camion anime la notion de route.",
    category: "stock",
    action: { kind: "link", href: "/delivery", label: "Livraison" },
  },
  {
    id: "prod-scrap",
    routes: ["/production"],
    modules: ["production"],
    title: "Scrap",
    body: "Enregistrez le scrap pour ne pas fausser le rendement et le stock matière.",
    category: "stock",
    action: {
      kind: "link",
      href: "/help/guide#stock",
      label: "Guide production",
    },
  },
  {
    id: "prod-smoke",
    routes: ["/production", "/"],
    modules: ["production"],
    title: "Icône usine",
    body: "Survolez Production : fumée discrète + micro-mouvement — même outline Lucide.",
    category: "navigation",
    action: { kind: "link", href: "/", label: "Launchpad" },
  },
  {
    id: "repair-stepup",
    routes: ["/repair"],
    modules: ["repair"],
    title: "Step-up",
    body: "Certaines actions SAFE demandent une re-auth — pas de contournement UI.",
    category: "ops",
    action: {
      kind: "link",
      href: "/help/guide#repair",
      label: "Guide Repair",
    },
  },
  {
    id: "ops-demo",
    routes: ["/", "/finance", "/hr"],
    modules: ["home", "finance", "hr"],
    title: "Mode démo client",
    body: "Activez SPECTRE avant projection grand écran — salaires et PII masqués.",
    category: "ops",
    action: { kind: "spectre", label: "SPECTRE maintenant" },
  },
  {
    id: "help-search",
    routes: ["/help"],
    modules: [],
    title: "Parcourir l’aide",
    body: "Les astuces sont groupées par catégorie — chaque lien mène à l’écran ou au guide.",
    category: "guide",
    action: { kind: "link", href: "/help", label: "Haut de page" },
  },
  {
    id: "guide-cheese",
    routes: ["/help/guide", "/"],
    modules: ["home"],
    title: "Contexte fromagerie",
    body: "AUTHORITY cible l’agroalimentaire B2B Tunisie (TND, TVA, CNSS) — architecture générique en dessous.",
    category: "guide",
    action: {
      kind: "link",
      href: "/help/guide",
      label: "User Guide",
    },
  },
  {
    id: "nav-rail",
    routes: ["/"],
    modules: ["home"],
    title: "Rail compact",
    body: "Réduisez la sidebar : icônes outline animées sans labels — plus d’espace Launchpad.",
    category: "navigation",
    action: { kind: "link", href: "/help#sidebar", label: "Sidebar" },
  },
  {
    id: "a11y-focus",
    routes: ["/help"],
    modules: [],
    title: "Focus clavier",
    body: "Tab fait apparaître « Aller au contenu » au centre — jamais collé en haut à gauche.",
    category: "a11y",
    action: { kind: "link", href: "/help#a11y", label: "A11y" },
  },
  {
    id: "notif-bell",
    routes: ["/"],
    modules: ["home"],
    title: "Notifications",
    body: "La cloche toolbar ouvre l’Activity Center — P0 en rouge doux sans cadre.",
    category: "navigation",
    action: { kind: "link", href: "/help#shortcuts", label: "Toolbar" },
  },

  {
    id: 'story-palette',
    routes: ['/', '/help'],
    modules: ['home'],
    title: 'La loupe ouvre un Spotlight, pas une barre de recherche',
    body: 'Cliquez la loupe (ou ⌘K) : une fenêtre flottante type Spotlight apparaît au centre. Tapez le nom d’un module, d’une facture, ou d’une action. Flèches pour choisir, Entrée pour ouvrir, Esc pour fermer. Ce n’est pas le champ « Rechercher… » d’autrefois — uniquement la loupe + cette fenêtre.',
    shortcut: '⌘K',
    category: 'navigation',
    action: { kind: 'palette', label: 'Essayer maintenant' },
  },
  {
    id: 'story-sidebar-click',
    routes: ['/'],
    modules: ['home'],
    title: 'Un clic module = liste métier',
    body: 'La sidebar liste seulement les modules (icône outline + nom). Un clic sélectionne le module et affiche ses fonctionnalités en liste dense sur l’accueil. Navigation Finder + liste Contiental (D159).',
    category: 'navigation',
    action: { kind: 'link', href: '/help#tip-story-sidebar-click', label: 'Lire dans l’aide' },
  },
  {
    id: 'story-brand',
    routes: ['/'],
    modules: ['home'],
    title: 'Identité société dans la barre du haut',
    body: 'Le logo Fattorie Covelli (PNG transparent) reste dans la barre horizontale : noir en thème clair, blanc en thème sombre. À droite, séparé par un trait élégant : Powered by AUTHORITY. Réduire la sidebar ne déplace jamais ce bandeau.',
    category: 'navigation',
    action: { kind: 'link', href: '/help#brand', label: 'Identité' },
  },
  {
    id: 'story-fodec',
    routes: ['/finance/invoices', '/settings'],
    modules: ['finance', 'settings'],
    title: 'FODEC & timbre : expertise avant calcul',
    body: 'Sur une facture, FODEC et timbre ne s’appliquent que si le siège Expertise correspondant est VALIDATED (valeur + référence légale + date expert). Tant que PENDING, les montants restent à 0 — AUTHORITY n’invente jamais un taux tunisien.',
    category: 'legal',
    action: { kind: 'link', href: '/settings#expertise', label: 'Ouvrir Expertise' },
  },
  {
    id: 'story-spectre',
    routes: ['/', '/hr', '/finance'],
    modules: ['home', 'hr', 'finance'],
    title: 'SPECTRE protège l’écran, pas la base',
    body: 'Activez SPECTRE dans la toolbar avant une démo client ou un audit en salle. Salaires, PII et montants sensibles sont masqués à l’affichage. Les droits API restent inchangés : SPECTRE est une couche visuelle ops, pas un bypass de permissions.',
    category: 'ops',
    action: { kind: 'spectre', label: 'Activer SPECTRE' },
  },
  {
    id: 'story-tva',
    routes: ['/tax', '/finance/invoices'],
    modules: ['tax', 'finance'],
    title: 'TVA Tunisie ≠ Expertise',
    body: 'Les codes 7 / 13 / 19 / 0 vivent dans le Tax Engine (/tax) avec lawRef. FODEC, timbre, CNSS, IRPP, TFP sont des sièges séparés dans Préférences › Expertise. Mélanger les deux sources est la cause n°1 des incohérences légales — gardez la frontière nette.',
    category: 'legal',
    action: { kind: 'link', href: '/help/guide#legal', label: 'Guide légal' },
  },
  {
    id: 'story-delivery',
    routes: ['/delivery', '/'],
    modules: ['delivery'],
    title: 'Livraison : le camion qui roule',
    body: 'Survolez Livraison (sidebar ou Launchpad) : l’icône camion anime une avancée. Métier : planifiez la tournée après confirmation commande, puis en route → livré. Les quantités et adresses restent tabulaires / lisibles hors SPECTRE.',
    category: 'stock',
    action: { kind: 'link', href: '/delivery', label: 'Ouvrir Livraison' },
  },
  {
    id: 'story-factory',
    routes: ['/production', '/'],
    modules: ['production'],
    title: 'Usine : fumée + scrap tracé',
    body: 'L’icône Production fait monter une fumée discrète au survol. Côté métier, chaque OF enregistre conso / sortie / scrap ; le stock est mis à jour via Inventory adjust — jamais hors-bande. Sans scrap déclaré, le rendement ment.',
    category: 'stock',
    action: { kind: 'link', href: '/production', label: 'Production' },
  },
  {
    id: 'story-promises',
    routes: ['/finance/promises', '/finance'],
    modules: ['finance'],
    title: 'Une promesse OPEN par créance',
    body: 'Promise-to-pay V0 : au plus une promesse OPEN liée à un open item. Elle passe KEPT à la clôture, BROKEN si en retard (calcul lazy), ou CANCELLED. V0 ne bloque pas automatiquement les ventes — la relance reste humaine.',
    category: 'finance',
    action: { kind: 'link', href: '/finance/promises', label: 'Promesses' },
  },
  {
    id: 'story-help-finish',
    routes: ['/', '/help'],
    modules: ['home'],
    title: 'Lire la suite dans le Centre d’aide',
    body: 'Chaque teaser ci-dessous (et sur chaque page) est un extrait. Le lien « Continuer dans l’aide » ouvre la fiche complète avec catégories Navigation, Finance, Stock, Légal, Ops et A11y — plus le User Guide pour le parcours fromagerie bout-en-bout.',
    category: 'guide',
    action: { kind: 'link', href: '/help', label: 'Ouvrir l’aide' },
  },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Tips for a pathname + module — rotated so pages don’t always show the same set. */
export function tipsForPage(
  pathname: string,
  moduleKey?: string,
  limit = 9,
): UsageTip[] {
  const path = pathname.split("#")[0] || "/";
  const dayBucket = Math.floor(Date.now() / 86_400_000);
  const salt = hashStr(`${path}|${moduleKey ?? ""}|${dayBucket}`);

  const scored = USAGE_TIPS.map((tip, index) => {
    let score = 0;
    const exact = tip.routes.some((r) => r === path);
    const prefix = tip.routes.some(
      (r) => r !== "/" && path.startsWith(r + "/"),
    );
    const rootHome = path === "/" && tip.routes.includes("/");
    if (exact) score += 6;
    else if (prefix) score += 4;
    else if (rootHome) score += 2;
    if (moduleKey && tip.modules.includes(moduleKey)) score += 5;
    // Prefer long-form teasers (headline + explanation)
    if (tip.body.length >= 140) score += 3;
    else if (tip.body.length >= 90) score += 1;
    if (tip.id.startsWith("story-")) score += 2;
    // Light jitter so equal scores rotate daily
    score += (hashStr(tip.id) + salt + index) % 3;
    return { tip, score };
  })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.tip.id.localeCompare(b.tip.id));

  const picked: UsageTip[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    if (seen.has(row.tip.id)) continue;
    seen.add(row.tip.id);
    picked.push(row.tip);
    if (picked.length >= limit) break;
  }

  if (picked.length < Math.min(3, limit)) {
    for (const t of USAGE_TIPS) {
      if (seen.has(t.id)) continue;
      if (t.category !== "guide") continue;
      picked.push(t);
      if (picked.length >= limit) break;
    }
  }

  return picked;
}

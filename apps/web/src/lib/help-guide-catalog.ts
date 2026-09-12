/**
 * Exhaustive Soft Glass Help / User Guide — FR source + IT overlay (D229).
 * Structure: module → when → features → steps.
 *
 * **D230 — mandatory:** every new user-facing feature must extend this catalog
 * (FR + IT) in the same lot. See `.cursor/rules/authority-help-i18n.mdc`.
 */

export type HelpLocale = "fr" | "it";

export type HelpFeature = {
  name: { fr: string; it: string };
  when: { fr: string; it: string };
  steps: { fr: string[]; it: string[] };
};

export type HelpModule = {
  id: string;
  href?: string;
  title: { fr: string; it: string };
  summary: { fr: string; it: string };
  when: { fr: string; it: string };
  features: HelpFeature[];
  locks?: { fr: string[]; it: string[] };
};

export const HELP_INTRO = {
  fr: {
    kicker: "Aide",
    title: "Centre d’aide AUTHORITY",
    description:
      "Guide opérationnel Soft Glass — tous les modules, fonctionnalités, quand et comment les utiliser, étape par étape.",
    toc: "Sommaire",
    whenLabel: "Quand l’utiliser",
    featuresLabel: "Fonctionnalités",
    stepsLabel: "Étapes",
    locksLabel: "Garde-fous",
    shortcutsTitle: "Raccourcis globaux",
    guideCta: "User Guide →",
    backHelp: "← Centre d’aide",
  },
  it: {
    kicker: "Aiuto",
    title: "Centro assistenza AUTHORITY",
    description:
      "Guida operativa Soft Glass — tutti i moduli, le funzioni, quando e come usarle, passo dopo passo.",
    toc: "Indice",
    whenLabel: "Quando usarlo",
    featuresLabel: "Funzionalità",
    stepsLabel: "Passi",
    locksLabel: "Vincoli",
    shortcutsTitle: "Scorciatoie globali",
    guideCta: "User Guide →",
    backHelp: "← Centro assistenza",
  },
} as const;

export const HELP_SHORTCUTS: { fr: string; it: string }[] = [
  {
    fr: "⌘K / Ctrl+K — palette de commandes (modules, actions, recherche).",
    it: "⌘K / Ctrl+K — palette comandi (moduli, azioni, ricerca).",
  },
  {
    fr: "Clic module (sidebar) — ouvre les fonctionnalités sur Mission Control.",
    it: "Clic sul modulo (sidebar) — apre le funzioni su Mission Control.",
  },
  {
    fr: "Modes SPECTRE / PATCH / GHOST — entrée par icônes topbar ; sortie uniquement via code calculatrice (Préférences).",
    it: "Modalità SPECTRE / PATCH / GHOST — ingresso da icone topbar; uscita solo con codice calcolatrice (Preferenze).",
  },
  {
    fr: "Langue — icône globe (FR ↔ IT) sur toute l’UI Soft Glass.",
    it: "Lingua — icona globo (FR ↔ IT) su tutta l’UI Soft Glass.",
  },
];

export const HELP_MODULES: HelpModule[] = [
  {
    id: "shell",
    href: "/",
    title: {
      fr: "Mission Control & chrome Soft Glass",
      it: "Mission Control e chrome Soft Glass",
    },
    summary: {
      fr: "Accueil registry-driven : KPIs live, widgets, liste de fonctionnalités du module sélectionné. Topbar, sidebar modules, Smart Action Dock.",
      it: "Home guidata dal registry: KPI live, widget, elenco funzioni del modulo selezionato. Topbar, sidebar moduli, Smart Action Dock.",
    },
    when: {
      fr: "Au démarrage de chaque session, pour orienter le poste et lancer une feature sans chercher dans la sidebar.",
      it: "All’avvio di ogni sessione, per orientare la postazione e avviare una funzione senza cercare nella sidebar.",
    },
    features: [
      {
        name: {
          fr: "Sélection de module",
          it: "Selezione modulo",
        },
        when: {
          fr: "Quand vous changez de domaine métier (Ventes, Finance, RH…).",
          it: "Quando cambi dominio (Vendite, Finanza, RH…).",
        },
        steps: {
          fr: [
            "Cliquez l’icône du module dans la sidebar Finder.",
            "Sur `/`, la liste Soft Glass des features du module apparaît.",
            "Cliquez une feature pour ouvrir la route métier.",
          ],
          it: [
            "Clicca l’icona del modulo nella sidebar Finder.",
            "Su `/` compare l’elenco Soft Glass delle feature del modulo.",
            "Clicca una feature per aprire la route operativa.",
          ],
        },
      },
      {
        name: {
          fr: "Smart Action Dock",
          it: "Smart Action Dock",
        },
        when: {
          fr: "Pour des raccourcis système / actions registry — jamais pour le contexte d’un enregistrement.",
          it: "Per scorciatoie di sistema / azioni registry — mai per il contesto di un record.",
        },
        steps: {
          fr: [
            "Utilisez le rail droit (Smart Actions, Thunder Core, toolbox).",
            "Le contexte fiche (synthèse commande / facture) reste in-page (ContextPanel), pas dans le dock.",
          ],
          it: [
            "Usa il rail destro (Smart Actions, Thunder Core, toolbox).",
            "Il contesto scheda resta in-page (ContextPanel), non nel dock.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Les features ne sont jamais listées dans la sidebar.",
        "Pas de KPI inventés — montants TND uniquement si données API.",
      ],
      it: [
        "Le feature non sono mai elencate nella sidebar.",
        "Nessun KPI inventato — importi TND solo se dati API.",
      ],
    },
  },
  {
    id: "sales",
    href: "/sales",
    title: { fr: "Ventes (commandes)", it: "Vendite (ordini)" },
    summary: {
      fr: "Prise de commande B2B multi-lignes, confirmation avec réserve stock, suivi fulfillment.",
      it: "Presa ordine B2B multi-riga, conferma con riserva scorte, tracking fulfillment.",
    },
    when: {
      fr: "Dès qu’un client commande des produits — avant livraison et facturation.",
      it: "Quando un cliente ordina prodotti — prima di consegna e fatturazione.",
    },
    features: [
      {
        name: {
          fr: "Liste commandes + filtres",
          it: "Elenco ordini + filtri",
        },
        when: {
          fr: "Pour retrouver un brouillon, une confirmée ou une annulée.",
          it: "Per trovare una bozza, un confermato o un annullato.",
        },
        steps: {
          fr: [
            "Ouvrez `/sales`.",
            "Filtrez par statut (Tout / Brouillon / Confirmée / Annulée).",
            "Recherchez par N°, client, surnom ou notes puis Filtrer.",
            "Cliquez le numéro pour ouvrir la fiche.",
          ],
          it: [
            "Apri `/sales`.",
            "Filtra per stato (Tutto / Bozza / Confermato / Annullato).",
            "Cerca per N°, cliente, nickname o note poi Filtra.",
            "Clicca il numero per aprire la scheda.",
          ],
        },
      },
      {
        name: {
          fr: "Nouvelle commande",
          it: "Nuovo ordine",
        },
        when: {
          fr: "Création d’une commande (brouillon ou confirmée selon le workflow).",
          it: "Creazione di un ordine (bozza o confermato secondo il workflow).",
        },
        steps: {
          fr: [
            "Cliquez « + Nouvelle commande ».",
            "Sélectionnez le client (autocomplete code / surnom).",
            "Choisissez l’entrepôt, date demandée, livreur souhaité si besoin.",
            "Ajoutez des lignes produit + quantités + prix (suggestion tarif négocié si existant).",
            "Enregistrez en brouillon ou confirmez (crédit → prix → stock / réserve).",
          ],
          it: [
            "Clicca « + Nuovo ordine ».",
            "Seleziona il cliente (autocomplete codice / nickname).",
            "Scegli magazzino, data richiesta, corriere se serve.",
            "Aggiungi righe prodotto + quantità + prezzo (tariffa negoziata se esiste).",
            "Salva in bozza o conferma (credito → prezzo → scorte / riserva).",
          ],
        },
      },
      {
        name: {
          fr: "Fiche commande",
          it: "Scheda ordine",
        },
        when: {
          fr: "Pour modifier un brouillon, confirmer, annuler, ou suivre le livré.",
          it: "Per modificare una bozza, confermare, annullare o seguire il consegnato.",
        },
        steps: {
          fr: [
            "Ouvrez `/sales/[id]`.",
            "Brouillon : Modifier → Enregistrer, ou Confirmer.",
            "Actions destructives via ••• (Annuler commande).",
            "Après confirmation : suivi fulfillment ; livraison via module Delivery.",
          ],
          it: [
            "Apri `/sales/[id]`.",
            "Bozza: Modifica → Salva, oppure Conferma.",
            "Azioni distruttive via ••• (Annulla ordine).",
            "Dopo conferma: tracking fulfillment; consegna via modulo Delivery.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de devis / remises inventées hors Prefs.",
        "FEFO / lots : allocation à la confirmation si suivi lot.",
      ],
      it: [
        "Nessun preventivo / sconto inventato fuori Prefs.",
        "FEFO / lotti: allocazione in conferma se tracking lotto.",
      ],
    },
  },
  {
    id: "customers",
    href: "/customers",
    title: { fr: "Clients", it: "Clienti" },
    summary: {
      fr: "Fiches clients B2B, tarifs négociés, hub financier (créances / aging).",
      it: "Schede clienti B2B, prezzi negoziati, hub finanziario (crediti / aging).",
    },
    when: {
      fr: "Avant la première commande, ou pour piloter le risque crédit / relances.",
      it: "Prima del primo ordine, o per gestire rischio credito / solleciti.",
    },
    features: [
      {
        name: {
          fr: "Créer / rechercher un client",
          it: "Creare / cercare un cliente",
        },
        when: {
          fr: "Nouveau compte commercial ou recherche rapide.",
          it: "Nuovo account commerciale o ricerca rapida.",
        },
        steps: {
          fr: [
            "Ouvrez `/customers`.",
            "« + Nouveau client » ou recherche par code / nom.",
            "Renseignez identité et paramètres commerciaux.",
            "Consultez le hub financier dans la fiche (encours, aging).",
          ],
          it: [
            "Apri `/customers`.",
            "« + Nuovo cliente » o cerca per codice / nome.",
            "Compila identità e parametri commerciali.",
            "Consulta l’hub finanziario nella scheda (esposizione, aging).",
          ],
        },
      },
    ],
  },
  {
    id: "products",
    href: "/products",
    title: { fr: "Produits", it: "Prodotti" },
    summary: {
      fr: "Catalogue articles (fromagerie) : suivi lot/DLC, conservation, offset production.",
      it: "Catalogo articoli (caseificio): tracking lotto/DLC, conservazione, offset produzione.",
    },
    when: {
      fr: "Quand un SKU entre au catalogue ou que la DLC / FEFO change.",
      it: "Quando uno SKU entra in catalogo o cambiano DLC / FEFO.",
    },
    features: [
      {
        name: {
          fr: "Catalogue & fiche produit",
          it: "Catalogo e scheda prodotto",
        },
        when: {
          fr: "Création / activation / archivage d’un produit.",
          it: "Creazione / attivazione / archiviazione di un prodotto.",
        },
        steps: {
          fr: [
            "Ouvrez `/products` → « + Nouveau produit ».",
            "Sur la fiche : shelf life, suivi lot, offset production.",
            "Enregistrer ; activer / archiver via overflow si besoin.",
          ],
          it: [
            "Apri `/products` → « + Nuovo prodotto ».",
            "In scheda: shelf life, tracking lotto, offset produzione.",
            "Salva; attiva / archivia via overflow se serve.",
          ],
        },
      },
    ],
  },
  {
    id: "inventory",
    href: "/inventory",
    title: { fr: "Stock & lots", it: "Scorte e lotti" },
    summary: {
      fr: "Soldes, lots FEFO, certificat de salubrité, ajustements inventaire.",
      it: "Saldi, lotti FEFO, certificato di salubrità, rettifiche inventario.",
    },
    when: {
      fr: "Contrôle physique, quarantaine, génération lots journaliers, certificat.",
      it: "Controllo fisico, quarantena, generazione lotti giornalieri, certificato.",
    },
    features: [
      {
        name: {
          fr: "Ajuster le stock",
          it: "Rettificare le scorte",
        },
        when: {
          fr: "Écart inventaire, casse, correction — jamais via un autre module fantôme.",
          it: "Scarto inventario, rottura, correzione — mai via altro modulo fantasma.",
        },
        steps: {
          fr: [
            "Ouvrez `/inventory` → Ajuster.",
            "Saisissez SKU / lot / quantité / motif.",
            "Confirmez (impact stock irréversible sans nouvel ajustement).",
          ],
          it: [
            "Apri `/inventory` → Rettifica.",
            "Inserisci SKU / lotto / quantità / motivo.",
            "Conferma (impatto irreversibile senza nuova rettifica).",
          ],
        },
      },
      {
        name: {
          fr: "Lots & certificat salubrité",
          it: "Lotti e certificato salubrità",
        },
        when: {
          fr: "Traçabilité DLC et documents clients / autorités.",
          it: "Tracciabilità DLC e documenti clienti / autorità.",
        },
        steps: {
          fr: [
            "Liste lots : `/inventory/lots` (OPEN / QUARANTINE / CLOSED).",
            "Certificat : `/inventory/certificat-salubrite` — générer / imprimer / partager.",
          ],
          it: [
            "Elenco lotti: `/inventory/lots` (OPEN / QUARANTINE / CLOSED).",
            "Certificato: `/inventory/certificat-salubrite` — genera / stampa / condividi.",
          ],
        },
      },
    ],
  },
  {
    id: "delivery",
    href: "/delivery",
    title: { fr: "Livraison", it: "Consegne" },
    summary: {
      fr: "Tournées / BL, livraison partielle, consommation FEFO, déclenchement AR.",
      it: "Giri / DDT, consegna parziale, consumo FEFO, avvio AR.",
    },
    when: {
      fr: "Après commande confirmée, pour préparer et clôturer l’expédition.",
      it: "Dopo ordine confermato, per preparare e chiudere la spedizione.",
    },
    features: [
      {
        name: {
          fr: "Nouvelle livraison / tournée",
          it: "Nuova consegna / giro",
        },
        when: {
          fr: "Quand il reste des quantités à livrer sur une commande.",
          it: "Quando restano quantità da consegnare su un ordine.",
        },
        steps: {
          fr: [
            "Ouvrez `/delivery`.",
            "Créez une livraison ou une tournée.",
            "Complétez partiellement ou totalement les lignes.",
            "La confirmation consomme les lots FEFO et met à jour le livré.",
          ],
          it: [
            "Apri `/delivery`.",
            "Crea una consegna o un giro.",
            "Completa parzialmente o totalmente le righe.",
            "La conferma consuma i lotti FEFO e aggiorna il consegnato.",
          ],
        },
      },
    ],
  },
  {
    id: "finance",
    href: "/finance",
    title: { fr: "Finance", it: "Finanza" },
    summary: {
      fr: "Créances AR, factures, avoirs, encaissements, instruments, promesses, banque, relances.",
      it: "Crediti AR, fatture, note di credito, incassi, strumenti, promesse, banca, solleciti.",
    },
    when: {
      fr: "Après livraison / facturation, pour encaisser et piloter le cash.",
      it: "Dopo consegna / fatturazione, per incassare e governare il cash.",
    },
    features: [
      {
        name: {
          fr: "Factures",
          it: "Fatture",
        },
        when: {
          fr: "Émettre une facture HT/TVA/TTC (FODEC/timbre si Expertise VALIDATED).",
          it: "Emettere una fattura HT/IVA/TTC (FODEC/bollo se Expertise VALIDATED).",
        },
        steps: {
          fr: [
            "Ouvrez `/finance/invoices` → « + Nouvelle facture ».",
            "Client, lignes, codes TVA, échéance.",
            "Sur la fiche : Émettre (DRAFT → ISSUED) ; Annuler / Avoir via overflow.",
            "Jamais inventer FODEC/timbre — Prefs Expertise seulement.",
          ],
          it: [
            "Apri `/finance/invoices` → « + Nuova fattura ».",
            "Cliente, righe, codici IVA, scadenza.",
            "In scheda: Emetti (DRAFT → ISSUED); Annulla / Nota via overflow.",
            "Mai inventare FODEC/bollo — solo Prefs Expertise.",
          ],
        },
      },
      {
        name: {
          fr: "Créances, paiements, banque",
          it: "Crediti, pagamenti, banca",
        },
        when: {
          fr: "Suivi encours, affectation paiements, rapprochement bancaire.",
          it: "Monitoraggio esposizione, allocazione pagamenti, riconciliazione bancaria.",
        },
        steps: {
          fr: [
            "`/finance` — créances ouvertes / échues.",
            "`/finance/payments` — enregistrer et affecter.",
            "`/finance/banking` — comptes, relevés CSV/OFX, rapprocher / ignorer.",
            "Relancer : dunning human-gated (mailto / WA selon Prefs).",
          ],
          it: [
            "`/finance` — crediti aperti / scaduti.",
            "`/finance/payments` — registra e alloca.",
            "`/finance/banking` — conti, estratti CSV/OFX, riconcilia / ignora.",
            "Sollecito: dunning human-gated (mailto / WA secondo Prefs).",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "FODEC / timbre : Prefs VALIDATED uniquement.",
        "GL via Thunder — Finance ≠ inventer la compta.",
      ],
      it: [
        "FODEC / bollo: solo Prefs VALIDATED.",
        "GL via Thunder — Finanza ≠ inventare la contabilità.",
      ],
    },
  },
  {
    id: "accounting",
    href: "/accounting",
    title: { fr: "Comptabilité", it: "Contabilità" },
    summary: {
      fr: "Plan comptable, balance, écritures, mapping GL, périodes.",
      it: "Piano dei conti, bilancio di verifica, registrazioni, mapping GL, periodi.",
    },
    when: {
      fr: "Contrôle GL, clôture de période, mapping comptes Prefs.",
      it: "Controllo GL, chiusura periodo, mapping conti Prefs.",
    },
    features: [
      {
        name: {
          fr: "Onglets CoA / Balance / Écritures / Mapping / Périodes",
          it: "Schede CoA / Bilancio / Registrazioni / Mapping / Periodi",
        },
        when: {
          fr: "Audit et paramétrage comptable société.",
          it: "Audit e parametrizzazione contabile azienda.",
        },
        steps: {
          fr: [
            "Ouvrez `/accounting`.",
            "Consultez CoA, balance, écritures filtrées par période.",
            "Mapping GL : Prefs sièges vides jusqu’à saisie humaine.",
            "Clôture / réouverture de période selon droits.",
          ],
          it: [
            "Apri `/accounting`.",
            "Consulta CoA, bilancio, registrazioni filtrate per periodo.",
            "Mapping GL: Prefs vuoti fino a inserimento umano.",
            "Chiusura / riapertura periodo secondo permessi.",
          ],
        },
      },
    ],
  },
  {
    id: "tax",
    href: "/tax",
    title: { fr: "Fiscalité (TVA)", it: "Fiscalità (IVA)" },
    summary: {
      fr: "Catalogue codes TVA Tunisie (Tax Engine) — distinct CNSS/IRPP RH.",
      it: "Catalogo codici IVA Tunisia (Tax Engine) — distinto da CNSS/IRPP RH.",
    },
    when: {
      fr: "Pour vérifier les taux applicables sur factures (lecture catalogue).",
      it: "Per verificare le aliquote applicabili sulle fatture (lettura catalogo).",
    },
    features: [
      {
        name: {
          fr: "Catalogue TVA",
          it: "Catalogo IVA",
        },
        when: {
          fr: "Référence légale des codes 7/13/19/0 — pas de saisie inventée.",
          it: "Riferimento legale codici 7/13/19/0 — nessun inserimento inventato.",
        },
        steps: {
          fr: [
            "Ouvrez `/tax`.",
            "Consultez codes et lawRef.",
            "Les factures consomment ces codes à l’émission.",
          ],
          it: [
            "Apri `/tax`.",
            "Consulta codici e lawRef.",
            "Le fatture usano questi codici in emissione.",
          ],
        },
      },
    ],
  },
  {
    id: "hr",
    href: "/hr",
    title: { fr: "Ressources humaines", it: "Risorse umane" },
    summary: {
      fr: "Employés, contrats, bulletins, CNSS/IRPP (Prefs), congés (attendance), virement.",
      it: "Dipendenti, contratti, buste paga, CNSS/IRPP (Prefs), congedi (attendance), bonifico.",
    },
    when: {
      fr: "Gestion du personnel et paie légère — payroll stub reste DISABLED.",
      it: "Gestione personale e paga leggera — payroll stub resta DISABLED.",
    },
    features: [
      {
        name: {
          fr: "Employés & fiche",
          it: "Dipendenti e scheda",
        },
        when: {
          fr: "Embauche, mise à jour identité / site / Identity link.",
          it: "Assunzione, aggiornamento identità / sede / link Identity.",
        },
        steps: {
          fr: [
            "`/hr` → « + Nouvel employé » (provision login optionnelle).",
            "Fiche `/hr/employees/[id]` : identité, contrats, fiscal, dossier, calendrier.",
            "Mot de passe provisoire affiché une seule fois à la création.",
          ],
          it: [
            "`/hr` → « + Nuovo dipendente » (provision login opzionale).",
            "Scheda `/hr/employees/[id]`: identità, contratti, fiscale, dossier, calendario.",
            "Password provvisoria mostrata una sola volta alla creazione.",
          ],
        },
      },
      {
        name: {
          fr: "Bulletins & ordre de virement",
          it: "Buste paga e ordine di bonifico",
        },
        when: {
          fr: "Après composition bulletin (CNSS/IRPP Prefs VALIDATED).",
          it: "Dopo composizione busta (CNSS/IRPP Prefs VALIDATED).",
        },
        steps: {
          fr: [
            "Générez / consultez le bulletin ; PDF serveur si disponible.",
            "Ordre de virement : DRAFT → confirm ADV → paiement bancaire soft.",
            "Jamais inventer taux CNSS/IRPP/TFP.",
          ],
          it: [
            "Genera / consulta la busta; PDF server se disponibile.",
            "Ordine bonifico: DRAFT → conferma ADV → pagamento bancario soft.",
            "Mai inventare aliquote CNSS/IRPP/TFP.",
          ],
        },
      },
      {
        name: {
          fr: "Congés & calendrier (attendance)",
          it: "Congedi e calendario (attendance)",
        },
        when: {
          fr: "Demandes d’absence / congés et événements RH (pénalité).",
          it: "Richieste assenza / congedi ed eventi RH (penale).",
        },
        steps: {
          fr: [
            "Onglet Congés sous RH (`/hr?tab=conges`) — pas de nav sidebar dédiée.",
            "Approuver / rejeter les demandes.",
            "Calendrier : LEAVE vert, ABSENCE rouge, PENALTY orange.",
          ],
          it: [
            "Scheda Congedi sotto RH (`/hr?tab=conges`) — nessuna nav sidebar dedicata.",
            "Approva / rifiuta le richieste.",
            "Calendario: LEAVE verde, ABSENCE rosso, PENALTY arancio.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Payroll stub DISABLED.",
        "Prefs Expertise / barèmes = vides jusqu’à saisie humaine VALIDATED.",
      ],
      it: [
        "Payroll stub DISABLED.",
        "Prefs Expertise / aliquote = vuote fino a inserimento umano VALIDATED.",
      ],
    },
  },
  {
    id: "production",
    href: "/production",
    title: { fr: "Production", it: "Produzione" },
    summary: {
      fr: "Ordres de fabrication, déclaration avec lots FEFO in/out.",
      it: "Ordini di produzione, dichiarazione con lotti FEFO in/out.",
    },
    when: {
      fr: "Transformation matière → produit fini traçable.",
      it: "Trasformazione materia → prodotto finito tracciabile.",
    },
    features: [
      {
        name: {
          fr: "Nouvel OF / déclaration",
          it: "Nuovo OF / dichiarazione",
        },
        when: {
          fr: "Lancement et clôture d’un OF avec lots obligatoires si trackLot.",
          it: "Avvio e chiusura OF con lotti obbligatori se trackLot.",
        },
        steps: {
          fr: [
            "`/production` → Nouvel OF.",
            "Déclarez consommations / sorties (lotIn / lotOut).",
            "Le stock est ajusté via Inventory — pas de double inventaire.",
          ],
          it: [
            "`/production` → Nuovo OF.",
            "Dichiara consumi / uscite (lotIn / lotOut).",
            "Le scorte si aggiornano via Inventory — nessun doppio inventario.",
          ],
        },
      },
    ],
  },
  {
    id: "documents",
    href: "/documents",
    title: { fr: "Documents", it: "Documenti" },
    summary: {
      fr: "Bibliothèque documents (DMS) liée aux dossiers RH / métier.",
      it: "Libreria documenti (DMS) collegata a dossier RH / operativi.",
    },
    when: {
      fr: "Dépôt et consultation de pièces (contrats, PDF, pièces jointes).",
      it: "Caricamento e consultazione documenti (contratti, PDF, allegati).",
    },
    features: [
      {
        name: {
          fr: "Déposer / filtrer",
          it: "Caricare / filtrare",
        },
        when: {
          fr: "Nouveau fichier ou recherche par type / lien.",
          it: "Nuovo file o ricerca per tipo / link.",
        },
        steps: {
          fr: [
            "`/documents` → Déposer un fichier.",
            "Filtrez et ouvrez le document (aperçu / téléchargement selon droits).",
          ],
          it: [
            "`/documents` → Carica un file.",
            "Filtra e apri il documento (anteprima / download secondo permessi).",
          ],
        },
      },
    ],
  },
  {
    id: "users",
    href: "/users",
    title: { fr: "Utilisateurs (Identité)", it: "Utenti (Identità)" },
    summary: {
      fr: "Comptes IAM société, invitations, rôles — pas Super Admin.",
      it: "Account IAM azienda, inviti, ruoli — non Super Admin.",
    },
    when: {
      fr: "Onboarding collaborateur ERP (hors portail employé automatisé RH).",
      it: "Onboarding collaboratore ERP (fuori portale dipendente automatizzato RH).",
    },
    features: [
      {
        name: {
          fr: "Nouvel utilisateur",
          it: "Nuovo utente",
        },
        when: {
          fr: "Accès ERP pour un rôle métier.",
          it: "Accesso ERP per un ruolo operativo.",
        },
        steps: {
          fr: [
            "`/users` → Nouvel utilisateur / invitation.",
            "Assignez société et rôles.",
            "Vérifiez SMTP Envois pour les invitations.",
          ],
          it: [
            "`/users` → Nuovo utente / invito.",
            "Assegna azienda e ruoli.",
            "Verifica SMTP Invii per gli inviti.",
          ],
        },
      },
    ],
  },
  {
    id: "settings",
    href: "/settings",
    title: { fr: "Préférences", it: "Preferenze" },
    summary: {
      fr: "Siège unique des paramètres société, modes, Expertise légale, Envois, mapping.",
      it: "Sede unica di parametri azienda, modalità, Expertise legale, Invii, mapping.",
    },
    when: {
      fr: "Configuration Admin — barèmes légaux vides jusqu’à validation humaine.",
      it: "Configurazione Admin — aliquote legali vuote fino a validazione umana.",
    },
    features: [
      {
        name: {
          fr: "Expertise & Envois",
          it: "Expertise e Invii",
        },
        when: {
          fr: "Saisie FODEC/timbre/CNSS/… et SMTP / WhatsApp dunning.",
          it: "Inserimento FODEC/bollo/CNSS/… e SMTP / WhatsApp dunning.",
        },
        steps: {
          fr: [
            "Ouvrez `/settings` — compartiments Soft Glass.",
            "Expertise : renseigner puis VALIDATED — jamais seed agent.",
            "Envois : host SMTP, tester l’envoi si configuré.",
            "Modes : code unlock SPECTRE/PATCH/GHOST.",
          ],
          it: [
            "Apri `/settings` — compartimenti Soft Glass.",
            "Expertise: compilare poi VALIDATED — mai seed agent.",
            "Invii: host SMTP, testa invio se configurato.",
            "Modalità: codice unlock SPECTRE/PATCH/GHOST.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Ne jamais inventer ni seed de taux tunisiens.",
        "Consumers métier seulement si VALIDATED.",
      ],
      it: [
        "Mai inventare né seed di aliquote tunisine.",
        "Consumer operativi solo se VALIDATED.",
      ],
    },
  },
  {
    id: "repair",
    href: "/repair",
    title: { fr: "Réparation (Thunder Repair)", it: "Riparazione (Thunder Repair)" },
    summary: {
      fr: "Scénarios SAFE/LOW allowlistés — diagnostic / repair contrôlé.",
      it: "Scenari SAFE/LOW in allowlist — diagnostica / riparazione controllata.",
    },
    when: {
      fr: "Incident technique plateforme — pas de fantaisie métier.",
      it: "Incidente tecnico piattaforma — nessuna fantasia operativa.",
    },
    features: [
      {
        name: {
          fr: "Lancer un scénario",
          it: "Avviare uno scenario",
        },
        when: {
          fr: "Après diagnostic, si le scénario est allowlisté.",
          it: "Dopo diagnostica, se lo scenario è in allowlist.",
        },
        steps: {
          fr: [
            "Ouvrez `/repair`.",
            "Choisissez un scénario SAFE/LOW.",
            "Suivez le stepper ; vérifiez l’audit — pas de fake rollback.",
          ],
          it: [
            "Apri `/repair`.",
            "Scegli uno scenario SAFE/LOW.",
            "Segui lo stepper; verifica l’audit — nessun fake rollback.",
          ],
        },
      },
    ],
  },
  {
    id: "portals",
    href: "/employee-portal",
    title: {
      fr: "Portails (employé / client)",
      it: "Portali (dipendente / cliente)",
    },
    summary: {
      fr: "Employee Portal : congés, calendrier, bulletins. Customer Portal : commandes / docs (shell séparé).",
      it: "Employee Portal: congedi, calendario, buste. Customer Portal: ordini / doc (shell separato).",
    },
    when: {
      fr: "Self-service collaborateur ou client B2B — cookies de session distincts.",
      it: "Self-service collaboratore o cliente B2B — cookie di sessione distinti.",
    },
    features: [
      {
        name: {
          fr: "Portail employé",
          it: "Portale dipendente",
        },
        when: {
          fr: "Après provision Identity à la création RH.",
          it: "Dopo provision Identity alla creazione RH.",
        },
        steps: {
          fr: [
            "Connexion `/employee-portal/login`.",
            "Demander / suivre congés ; voir calendrier.",
            "Consulter / imprimer ses bulletins (own only — IDOR→404).",
          ],
          it: [
            "Login `/employee-portal/login`.",
            "Richiedere / seguire congedi; vedere calendario.",
            "Consultare / stampare le proprie buste (own only — IDOR→404).",
          ],
        },
      },
    ],
  },
];

export function helpText(
  locale: HelpLocale,
  pair: { fr: string; it: string },
): string {
  return locale === "it" ? pair.it : pair.fr;
}

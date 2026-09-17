/**
 * Exhaustive AUTHORITY Help / User Guide — FR source + IT overlay (D229).
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
      "Guide opérationnel AUTHORITY — tous les modules, fonctionnalités, quand et comment les utiliser, étape par étape.",
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
      "Guida operativa AUTHORITY — tutti i moduli, le funzioni, quando e come usarle, passo dopo passo.",
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
    fr: "⌘K / Ctrl+K — palette de commandes (modules actifs + permissions session).",
    it: "⌘K / Ctrl+K — palette comandi (moduli attivi + permessi sessione).",
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
    fr: "Langue — icône globe (FR ↔ IT) sur toute l’UI AUTHORITY.",
    it: "Lingua — icona globo (FR ↔ IT) su tutta l’UI AUTHORITY.",
  },
];

export const HELP_MODULES: HelpModule[] = [
  {
    id: "shell",
    href: "/",
    title: {
      fr: "Mission Control & chrome AUTHORITY",
      it: "Mission Control e chrome AUTHORITY",
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
            "Sur `/`, la liste AUTHORITY des features du module apparaît.",
            "Cliquez une feature pour ouvrir la route métier.",
          ],
          it: [
            "Clicca l’icona del modulo nella sidebar Finder.",
            "Su `/` compare l’elenco AUTHORITY delle feature del modulo.",
            "Clicca una feature per aprire la route operativa.",
          ],
        },
      },
      {
        name: {
          fr: "AUTHORITY X (topbar)",
          it: "AUTHORITY X (topbar)",
        },
        when: {
          fr: "Commande flottante rapide sans quitter AUTHORITY.",
          it: "Comando fluttuante rapido senza lasciare AUTHORITY.",
        },
        steps: {
          fr: [
            "Cliquez l’orbe « X » teal dans la topbar (à gauche des notifications).",
            "Le companion AUTHORITY X passe au premier plan — AUTHORITY reste ouvert derrière.",
            "Sinon : raccourci CTRL+X si le tray Electron tourne.",
            "Appairage : Préférences → Poste → Générer un code, coller dans X (jeton keyring, D274).",
            "Si hors ligne : lancez `npm run dev -w authority-x` (tray).",
          ],
          it: [
            "Clicca l’orbe « X » teal nella topbar (a sinistra delle notifiche).",
            "Il companion AUTHORITY X passa in primo piano — AUTHORITY resta aperto sotto.",
            "Altrimenti: scorciatoia CTRL+X se il tray Electron è attivo.",
            "Associazione: Preferenze → Postazione → Genera un codice, incolla in X (token keyring, D274).",
            "Se offline: avvia `npm run dev -w authority-x` (tray).",
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
      {
        name: {
          fr: "Centre de notifications",
          it: "Centro notifiche",
        },
        when: {
          fr: "Alertes métier : crédit breach, promesse échue, déclaration portail, relance DRAFT, RAS Prefs PENDING, besoin production.",
          it: "Avvisi operativi: credito breach, promessa scaduta, dichiarazione portale, sollecito DRAFT, RAS Prefs PENDING, fabbisogno produzione.",
        },
        steps: {
          fr: [
            "Cliquez la cloche topbar — sync API (+ Actualiser).",
            "Thunder `notifications.materialize` resync l’inbox après events métier (D290).",
            "Source « Besoin production » : commande confirmée + module Production ON — hint OF manuel uniquement.",
            "Paramètres (drawer ou `/settings#poste`) : mute par source, audio AUTHORITY, animations.",
            "Variantes audio Soft / Pulse / Carillon + volume + Tester le ton.",
            "Clic droit sur un chip source = mute / unmute rapide.",
            "Pas de messagerie CRM · pas de WA inbox→order · pas d’OF auto.",
          ],
          it: [
            "Clicca la campana topbar — sync API (+ Aggiorna).",
            "Thunder `notifications.materialize` risincronizza l’inbox dopo eventi business (D290).",
            "Fonte « Fabbisogno produzione »: ordine confermato + modulo Production ON — solo hint OF manuale.",
            "Parametri (drawer o `/settings#poste`): mute per sorgente, audio AUTHORITY, animazioni.",
            "Varianti audio Soft / Pulse / Chime + volume + Prova tono.",
            "Clic destro su un chip sorgente = mute / unmute rapido.",
            "Niente messaggistica CRM · niente WA inbox→order · niente OF auto.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Les features ne sont jamais listées dans la sidebar.",
        "Pas de KPI inventés — montants TND uniquement si données API.",
        "Notifications = inbox AUTHORITY (D247–D249/D290) — prefs poste local · pas un CRM · pas d’OF auto.",
      ],
      it: [
        "Le feature non sono mai elencate nella sidebar.",
        "Nessun KPI inventato — importi TND solo se dati API.",
        "Notifiche = inbox AUTHORITY (D247–D249/D290) — prefs postazione local · non un CRM · niente OF auto.",
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
            "Filtrez par statut (Tout / Brouillon / Confirmée / Annulée) — URL `?status=` partageable.",
            "Recherchez commandes / clients / références ; utilisez Filtrer · Densité (Grouper / Colonnes bientôt).",
            "Lisez le tableau (Commande · Client · Date · Statut · Montant · Livraison) — cliquez une ligne ou le N° pour la fiche.",
          ],
          it: [
            "Apri `/sales`.",
            "Filtra per stato (Tutto / Bozza / Confermato / Annullato) — URL `?status=` condividibile.",
            "Cerca ordini / clienti / riferimenti ; usa Filtra · Densità (Raggruppa / Colonne presto).",
            "Leggi la tabella (Ordine · Cliente · Data · Stato · Importo · Consegna) — clicca riga o N° per la scheda.",
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
      {
        name: {
          fr: "Inbox WhatsApp → brouillon",
          it: "Inbox WhatsApp → bozza",
        },
        when: {
          fr: "Un client écrit sur WhatsApp Business ; ADV crée un brouillon AUTHORITY.",
          it: "Un cliente scrive su WhatsApp Business; ADV crea una bozza AUTHORITY.",
        },
        steps: {
          fr: [
            "Prefs → Relances : webhook Meta (verify_token + app_secret) déjà utilisés pour dunning.",
            "Ouvrez `/sales/wa-inbox` (feature Ventes) — ou cloche → source WA.",
            "Message OPEN/MATCHED : lier le client si besoin (contact.whatsapp).",
            "« Créer brouillon » : chips suggestions produit (assistées) ou saisie manuelle → DRAFT.",
            "Confirmer ensuite via `/sales/[id]` (`sales.confirm`) — jamais auto.",
          ],
          it: [
            "Prefs → Solleciti: webhook Meta (verify_token + app_secret) già usati per dunning.",
            "Apri `/sales/wa-inbox` (feature Vendite) — o campana → fonte WA.",
            "Messaggio OPEN/MATCHED: collega il cliente se serve (contact.whatsapp).",
            "« Créer brouillon »: chip suggerimenti prodotto (assistiti) o inserimento manuale → DRAFT.",
            "Conferma poi da `/sales/[id]` (`sales.confirm`) — mai auto.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de devis / remises inventées hors Prefs.",
        "FEFO / lots : allocation à la confirmation si suivi lot.",
        "WA→order = human-gated — suggestions assistées OK · pas d’auto-confirm · pas de CRM chat (D251/D252).",
      ],
      it: [
        "Nessun preventivo / sconto inventato fuori Prefs.",
        "FEFO / lotti: allocazione in conferma se tracking lotto.",
        "WA→order = human-gated — suggerimenti assistiti OK · niente auto-confirm · niente CRM chat (D251/D252).",
      ],
    },
  },
  {
    id: "customers",
    href: "/customers",
    title: { fr: "Clients", it: "Clienti" },
    summary: {
      fr: "Fiche 360 AUTHORITY, tarifs négociés, hub financier (créances / aging), profil fiscal.",
      it: "Scheda 360 AUTHORITY, prezzi negoziati, hub finanziario (crediti / aging), profilo fiscale.",
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
            "Ouvrez la fiche 360 via le code client ou « Fiche ».",
          ],
          it: [
            "Apri `/customers`.",
            "« + Nuovo cliente » o cerca per codice / nome.",
            "Compila identità e parametri commerciali.",
            "Apri la scheda 360 dal codice cliente o « Fiche ».",
          ],
        },
      },
      {
        name: {
          fr: "Document — facture ou bon de livraison",
          it: "Documento — fattura o bolla di consegna",
        },
        when: {
          fr: "Le titre imprimé est un bon de livraison (défaut) ou une facture — même contenu, même compta.",
          it: "Il titolo stampato è una bolla di consegna (predefinito) o una fattura — stesso contenuto, stessa contabilità.",
        },
        steps: {
          fr: [
            "Fiche `/customers/[id]` → Éditer → toggle Document : Bon de livraison (défaut) ou Facture.",
            "À la facturation (`/finance/invoices` → Nouvelle facture), le titre reprend la fiche.",
            "Vous pouvez le changer pour ce document seulement — ça ne change que le titre.",
            "Même lignes, même AR/GL, mêmes modes SPECTRE / PATCH / GHOST.",
          ],
          it: [
            "Scheda `/customers/[id]` → Éditer → toggle Documento: Bolla di consegna (predefinito) o Fattura.",
            "In fatturazione (`/finance/invoices` → Nuova fattura) il titolo riprende la scheda.",
            "Puoi cambiarlo solo per questo documento — cambia soltanto il titolo.",
            "Stesse righe, stesso AR/GL, stessi modi SPECTRE / PATCH / GHOST.",
          ],
        },
      },
      {
        name: {
          fr: "Fiche client 360",
          it: "Scheda cliente 360",
        },
        when: {
          fr: "Pilotage quotidien : encours, actions requises, documents, communication.",
          it: "Gestione quotidiana: esposizione, azioni richieste, documenti, comunicazione.",
        },
        steps: {
          fr: [
            "Depuis `/customers`, cliquez le code ou « Fiche » → `/customers/[id]`.",
            "Onglets Synthèse / Documents / Communication (chargement à la demande).",
            "Synthèse : KPI, aging, Action requise, contacts / adresses / tarifs / timeline.",
            "Documents : fichiers liés · dépôt via `/documents` (lien CUSTOMER).",
            "Communication : canaux · contacts · dunning · déclarations portail (pas de CRM chat).",
            "« Éditer » + Portail (D242) ; overflow pour commande / bloquer.",
          ],
          it: [
            "Da `/customers`, clicca il codice o « Fiche » → `/customers/[id]`.",
            "Tab Sintesi / Documenti / Comunicazione (caricamento on-demand).",
            "Sintesi: KPI, aging, Azioni richieste, contatti / indirizzi / tariffe / timeline.",
            "Documenti: file collegati · upload via `/documents` (link CUSTOMER).",
            "Comunicazione: canali · contatti · solleciti · dichiarazioni portale (niente CRM chat).",
            "« Éditer » + Portale (D242); overflow per ordine / blocco.",
          ],
        },
      },
      {
        name: {
          fr: "Fiscalité client",
          it: "Fiscalità cliente",
        },
        when: {
          fr: "Classer le client (régime, assujettissement) ou déroger à un code fiscal ACTIVE, avec justification.",
          it: "Classificare il cliente (regime, assoggettamento) o derogare a un codice fiscale ACTIVE, con giustificazione.",
        },
        steps: {
          fr: [
            "Fiche 360 → Synthèse → section Fiscalité.",
            "Le MF s’édite via « Éditer » (pièce d’identité) — pas ici.",
            "Renseignez régime / statut / catégorie / assujetti TVA, puis « Enregistrer le fiscal ».",
            "Dérogation : choisissez un code, un mode (Toujours / Jamais / Confirmer) et une justification obligatoire.",
            "Jamais = exonération auditée (NEVER). Toujours n’active pas une règle PENDING_EXPERT.",
            "« Auto » retire la dérogation. RAS AR est un flag inactif (architecture) — RAS auto = AP plus tard.",
          ],
          it: [
            "Scheda 360 → Sintesi → sezione Fiscalità.",
            "Il MF si modifica da « Éditer » (identità) — non qui.",
            "Compila regime / stato / categoria / assoggettato IVA, poi « Enregistrer le fiscal ».",
            "Deroga: scegli un codice, una modalità (Toujours / Jamais / Confirmer) e una giustificazione obbligatoria.",
            "Jamais = esenzione auditata (NEVER). Toujours non attiva una regola PENDING_EXPERT.",
            "« Auto » toglie la deroga. RAS AR è un flag inattivo (architettura) — RAS auto = AP più tardi.",
          ],
        },
      },
      {
        name: {
          fr: "Portail — utilisateurs liés",
          it: "Portale — utenti collegati",
        },
        when: {
          fr: "Donner ou retirer l’accès `/portal` à un compte Identity de la société.",
          it: "Dare o revocare l’accesso `/portal` a un account Identity della società.",
        },
        steps: {
          fr: [
            "Fiche client → section Portail → « + Utilisateur portail ».",
            "Choisissez un utilisateur Identity (Filtrer) et un rôle (Acheteur / Lecture / Admin).",
            "Révoquer coupe le login portail (status REVOKED) ; Réactiver le rétablit.",
            "Création de compte = module Identité — pas depuis Clients.",
          ],
          it: [
            "Scheda cliente → sezione Portale → « + Utilisateur portail ».",
            "Scegli un utente Identity (Filtrer) e un ruolo (Acquirente / Lettura / Admin).",
            "Révoquer blocca il login portale (REVOKED); Réactiver lo ripristina.",
            "Creazione account = modulo Identità — non da Clienti.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de module CRM parallèle — AUTHORITY only (D294/D241/D244).",
        "Communication = dunning + déclarations — pas de messagerie SoT (D244).",
        "WA→commande, TEJ/RAS et automations FULL_AUTO reportés (Prefs VALIDATED pour tax).",
        "Module Portails ENABLED requis pour lier / révoquer (D242).",
        "Dérogation fiscale NEVER = exonération justifiée + audit — jamais un bypass silencieux (D260). ALWAYS n’active pas PENDING_EXPERT. RAS AR flag architecture only.",
        "Document = titre (bon de livraison par défaut / facture) ; surchargeable à l’émission — même `fin_invoice`, AR/GL/modes inchangés (D262).",
      ],
      it: [
        "Nessun modulo CRM parallelo — AUTHORITY only (D294/D241/D244).",
        "Comunicazione = solleciti + dichiarazioni — niente messaging SoT (D244).",
        "WA→ordine, TEJ/RAS e automazioni FULL_AUTO differiti (Prefs VALIDATED per tax).",
        "Modulo Portali ENABLED richiesto per collegare / revocare (D242).",
        "Deroga fiscale NEVER = esenzione giustificata + audit — mai un bypass silenzioso (D260). ALWAYS non attiva PENDING_EXPERT. Flag RAS AR solo architettura.",
        "Documento = titolo (bolla di consegna predefinita / fattura); sovrascrivibile all’emissione — stesso `fin_invoice`, AR/GL/modi invariati (D262).",
      ],
    },
  },
  {
    id: "suppliers",
    href: "/suppliers",
    title: { fr: "Fournisseurs", it: "Fornitori" },
    summary: {
      fr: "Master AUTHORITY : catégorie (lait / emballage / fourniture / import), contacts, délai, MOQ, hold qualité. Lien optionnel sur factures AP.",
      it: "Anagrafica AUTHORITY: categoria (latte / imballo / fornitura / import), contatti, lead time, MOQ, hold qualità. Link opzionale sulle fatture AP.",
    },
    when: {
      fr: "Avant la première facture fournisseur, ou pour standardiser les vendors AP.",
      it: "Prima della prima fattura fornitore, o per standardizzare i vendor AP.",
    },
    features: [
      {
        name: {
          fr: "Créer / rechercher un fournisseur",
          it: "Creare / cercare un fornitore",
        },
        when: {
          fr: "Nouveau vendor ou recherche rapide.",
          it: "Nuovo vendor o ricerca rapida.",
        },
        steps: {
          fr: [
            "Ouvrez `/suppliers` (module Fournisseurs ENABLED + `suppliers.read`).",
            "« + Nouveau fournisseur » : code, raison sociale, catégorie, délai, MOQ.",
            "Contact initial optionnel à la création.",
            "Ouvrez la fiche via le code ou « Fiche ».",
          ],
          it: [
            "Apri `/suppliers` (modulo Fornitori ENABLED + `suppliers.read`).",
            "« + Nouveau fournisseur »: codice, ragione sociale, categoria, lead time, MOQ.",
            "Contatto iniziale opzionale in creazione.",
            "Apri la scheda dal codice o « Fiche ».",
          ],
        },
      },
      {
        name: {
          fr: "Supplier 360 — synthèse AP",
          it: "Supplier 360 — sintesi AP",
        },
        when: {
          fr: "Voir l’exposition AP et l’historique liés au master.",
          it: "Vedere l’esposizione AP e lo storico legati al master.",
        },
        steps: {
          fr: [
            "`/suppliers/[id]` charge synthèse : POSTED / brouillons / ouvert / payé (TND).",
            "Factures et paiements récents · timeline AP · actions hold / brouillons.",
            "Liste : chips Actifs / Hold / Bloqués.",
            "Lien « Factures fournisseurs » filtre `?supplierId=`.",
          ],
          it: [
            "`/suppliers/[id]` carica sintesi: POSTED / bozze / aperto / pagato (TND).",
            "Fatture e pagamenti recenti · timeline AP · azioni hold / bozze.",
            "Lista: chip Attivi / Hold / Bloccati.",
            "Link « Fatture fornitori » filtra `?supplierId=`.",
          ],
        },
      },
      {
        name: {
          fr: "Fiche fournisseur + hold qualité",
          it: "Scheda fornitore + hold qualità",
        },
        when: {
          fr: "Mettre à jour le profil ou bloquer temporairement un vendor.",
          it: "Aggiornare il profilo o sospendere temporaneamente un vendor.",
        },
        steps: {
          fr: [
            "`/suppliers/[id]` → Éditer (version optimistic).",
            "••• → Hold qualité (`suppliers.hold`) — peut passer le statut En hold.",
            "Ajouter des contacts depuis la fiche.",
            "Factures AP : choisir le master dans `/finance/ap-bills` (vendorName reste affichage).",
          ],
          it: [
            "`/suppliers/[id]` → Éditer (version optimistic).",
            "••• → Hold qualità (`suppliers.hold`) — può impostare stato En hold.",
            "Aggiungi contatti dalla scheda.",
            "Fatture AP: scegli il master in `/finance/ap-bills` (vendorName resta display).",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de commandes achat / prix / réceptions stock / portail fournisseur.",
        "vendorName libre toujours possible sur AP — master optionnel.",
        "Totaux AP as-recorded (POSTED / paiements liés) — pas d’aging fournisseur V0.",
      ],
      it: [
        "Niente ordini acquisto / prezzi / ricevimenti stock / portale fornitore.",
        "vendorName libero sempre possibile su AP — master opzionale.",
        "Totali AP as-recorded (POSTED / pagamenti collegati) — niente aging fornitore V0.",
      ],
    },
  },
  {
    id: "fleet",
    href: "/fleet",
    title: { fr: "Flotte", it: "Flotta" },
    summary: {
      fr: "Véhicules AUTHORITY (froid, capacité, odomètre), chauffeur habitué, carnet (vidange/pneus/carburant/km), affectation tournée. Pas de GPS.",
      it: "Veicoli AUTHORITY (freddo, capacità, km), autista abituale, libretto (olio/gomme/carburante/km), assegnazione giro. Niente GPS.",
    },
    when: {
      fr: "Quand vous planifiez une tournée ou suivez l’entretien d’un camion.",
      it: "Quando pianificate un giro o seguite la manutenzione di un camion.",
    },
    features: [
      {
        name: {
          fr: "Liste, chips statut et fiche véhicule",
          it: "Lista, chip stato e scheda veicolo",
        },
        when: {
          fr: "Nouveau camion, filtre statut, ou consultation historique.",
          it: "Nuovo camion, filtro stato, o consultazione storico.",
        },
        steps: {
          fr: [
            "Ouvrez `/fleet` (module Flotte ENABLED + `fleet.manage`).",
            "Chips statut (Tous / Actif / En atelier / Hors service / Archivé).",
            "« + Nouveau véhicule » (chauffeur habitué optionnel) ou fiche `/fleet/[id]`.",
            "Sur la fiche : Éditer · carnet · historique d’affectations.",
            "Si un équipement Maintenance est lié (`vehicleId`) → lien AUTHORITY « Équipement maintenance ».",
          ],
          it: [
            "Apri `/fleet` (modulo Flotta ENABLED + `fleet.manage`).",
            "Chip stato (Tutti / Attivo / In officina / Fuori servizio / Archiviato).",
            "« + Nouveau véhicule » (autista abituale opzionale) o scheda `/fleet/[id]`.",
            "In scheda: Éditer · libretto · storico assegnazioni.",
            "Se un asset Manutenzione è collegato (`vehicleId`) → link AUTHORITY « Équipement maintenance ».",
          ],
        },
      },
      {
        name: {
          fr: "Carnet véhicule + chauffeur habitué",
          it: "Libretto veicolo + autista abituale",
        },
        when: {
          fr: "Vidange, pneus, carburant, relevé km ; rappel prochaine vidange.",
          it: "Olio, gomme, carburante, km; reminder prossimo tagliando.",
        },
        steps: {
          fr: [
            "Fiche `/fleet/[id]` → Champ « Chauffeur habitué » (texte libre, pas RH).",
            "« + Entrée carnet » : type (Kilométrage / Vidange / Pneus / Carburant / Autre).",
            "Une vidange met à jour odomètre + propose prochain km (+10 000) et date (+6 mois).",
            "Bandeau « Entretien dû » si date ou km dépassés (rappel UI, pas de job Thunder).",
            "À l’assign planning : préremplit le chauffeur avec le habitué du véhicule si défini.",
          ],
          it: [
            "Scheda `/fleet/[id]` → campo « Chauffeur habitué » (testo libero, non HR).",
            "« + Entrée carnet »: tipo (Km / Olio / Gomme / Carburante / Altro).",
            "Un cambio olio aggiorna km + propone prossimo km (+10 000) e data (+6 mesi).",
            "Banner « Entretien dû » se data o km superati (reminder UI, niente job Thunder).",
            "In assign planning: precompila l’autista con l’abituale del veicolo se definito.",
          ],
        },
      },
      {
        name: {
          fr: "Affecter avec hint froid + strip Livraison",
          it: "Assegnare con hint freddo + strip Consegne",
        },
        when: {
          fr: "Tournée Delivery à pourvoir ; contrôle périssable avant assign.",
          it: "Giro Delivery da assegnare; controllo deperibili prima dell’assegnazione.",
        },
        steps: {
          fr: [
            "`/fleet?tab=planning` (`fleet.assign` + Delivery).",
            "Assigner → bandeau si produits périssables · select préfiltré véhicules froids.",
            "`FLT.NOT_COLD` / `FLT.CAPACITY` si règles violées.",
            "Sur `/delivery` : badge lecture seule « Véhicule · CODE · PLAQUE » (silencieux si Flotte off).",
            "ADV « Copier chauffeur → tournée » : copie le chauffeur d’affectation vers `dlv_round.driverLabel` (jamais auto à l’assign).",
          ],
          it: [
            "`/fleet?tab=planning` (`fleet.assign` + Delivery).",
            "Assegna → banner se prodotti deperibili · select prefiltrato veicoli freddi.",
            "`FLT.NOT_COLD` / `FLT.CAPACITY` se regole violate.",
            "Su `/delivery`: badge sola lettura « Véhicule · CODE · PLAQUE » (silenzioso se Flotta off).",
            "ADV « Copier chauffeur → tournée »: copia l’autista assegnazione su `dlv_round.driverLabel` (mai auto all’assegnazione).",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de GPS / POD / mobile livreur (D253/D254).",
        "Pas de FK véhicule sur `dlv_round` — table `flt_assignment` seule.",
        "Chauffeur flotte / habitué ≠ Identity / RH — texte libre.",
        "Copie chauffeur → tournée = ADV explicite seulement (D255) — pas d’auto-sync.",
        "Carnet = journal ADV (D257) — pas pompe auto · pas stock pièces · pas GL sur montant TND.",
      ],
      it: [
        "Niente GPS / POD / mobile autista (D253/D254).",
        "Niente FK veicolo su `dlv_round` — solo tabella `flt_assignment`.",
        "Autista flotta / abituale ≠ Identity / HR — testo libero.",
        "Copia autista → giro = ADV esplicito solo (D255) — niente auto-sync.",
        "Libretto = diario ADV (D257) — niente pompa auto · pezzi · GL su importo TND.",
      ],
    },
  },
  {
    id: "maintenance",
    href: "/maintenance",
    title: { fr: "Maintenance", it: "Manutenzione" },
    summary: {
      fr: "Fiche équipement AUTHORITY, OT panne/préventif ADV, chips Ouverts/Terminés, lien flotte ↔ maintenance. Pas de job Thunder ni pièces Inventory.",
      it: "Scheda attrezzatura AUTHORITY, OT guasto/preventivo ADV, chip Aperti/Completati, link flotta ↔ manutenzione. Niente job Thunder né pezzi Inventory.",
    },
    when: {
      fr: "Quand une cuve, presse, chambre froide ou camion est en panne ou dû en préventif.",
      it: "Quando una vasca, pressa, cella o camion è in guasto o in scadenza preventivo.",
    },
    features: [
      {
        name: {
          fr: "Équipements + fiche + lien flotte + préventif dû",
          it: "Attrezzature + scheda + link flotta + preventivo scaduto",
        },
        when: {
          fr: "Créer / éditer un asset ; ouvrir la fiche ; filtrer préventif dû.",
          it: "Creare / modificare un asset; aprire la scheda; filtrare preventivo scaduto.",
        },
        steps: {
          fr: [
            "Ouvrez `/maintenance` (module Maintenance ENABLED + `maintenance.asset`).",
            "« + Nouvel équipement » : code, libellé, type, véhicule flotte optionnel, date préventive.",
            "Cliquez le code → fiche `/maintenance/[id]` (Down/Up, éditer, historique OT).",
            "Si préventif dû → « OT préventif » (ADV, `maintenance.wo`) — pas d’auto.",
            "Lien « Véhicule flotte » sur la fiche si `vehicleId` ; inverse depuis `/fleet/[id]`.",
          ],
          it: [
            "Apri `/maintenance` (modulo Manutenzione ENABLED + `maintenance.asset`).",
            "« + Nouvel équipement »: codice, etichetta, tipo, veicolo flotta opzionale, data preventivo.",
            "Clic sul codice → scheda `/maintenance/[id]` (Down/Up, modifica, storico OT).",
            "Se preventivo scaduto → « OT préventif » (ADV, `maintenance.wo`) — niente auto.",
            "Link « Véhicule flotte » sulla scheda se `vehicleId`; inverso da `/fleet/[id]`.",
          ],
        },
      },
      {
        name: {
          fr: "Ordres de travail (OT) + historique",
          it: "Ordini di lavoro (OT) + storico",
        },
        when: {
          fr: "Ouvrir un OT panne ou préventif puis le terminer ; filtrer Ouverts / Terminés / Tous.",
          it: "Aprire un OT guasto o preventivo e completarlo; filtrare Aperti / Completati / Tutti.",
        },
        steps: {
          fr: [
            "`/maintenance?tab=wo` (`maintenance.wo`).",
            "Chips Ouverts · Terminés · Tous.",
            "Créer OT depuis la liste, la fiche, ou « OT préventif » si dû.",
            "« Terminer » → status DONE (pas d’auto Up de l’équipement).",
          ],
          it: [
            "`/maintenance?tab=wo` (`maintenance.wo`).",
            "Chip Aperti · Completati · Tutti.",
            "Crea OT dalla lista, dalla scheda, o « OT préventif » se scaduto.",
            "« Terminer » → status DONE (niente Up automatico dell’asset).",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Lien flotte = `vehicleId` optionnel seulement (1A) — pas de FK carnet→OT · pas de sync statut camion.",
        "Date préventive = rappel UI (2B) — pas de job `maintenance.preventive_due`.",
        "OT préventif = ADV uniquement — pas d’auto depuis carnet flotte.",
        "Pas de pièces Inventory · pas de blocage OF Production · pas de full CMMS.",
      ],
      it: [
        "Link flotta = solo `vehicleId` opzionale (1A) — niente FK libretto→OT · niente sync stato camion.",
        "Data preventivo = reminder UI (2B) — niente job `maintenance.preventive_due`.",
        "OT preventivo = solo ADV — niente auto dal libretto flotta.",
        "Niente pezzi Inventory · niente blocco OF Produzione · niente full CMMS.",
      ],
    },
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
      {
        name: {
          fr: "Fiscalité produit",
          it: "Fiscalità prodotto",
        },
        when: {
          fr: "Classer le SKU (TVA par défaut, HS) ou déroger à un code fiscal ACTIVE, avec justification.",
          it: "Classificare lo SKU (IVA predefinita, HS) o derogare a un codice fiscale ACTIVE, con giustificazione.",
        },
        steps: {
          fr: [
            "Fiche `/products/[id]` → section Fiscalité (sous Identité produit).",
            "Choisissez une TVA par défaut (codes VAT seulement) — fallback moteur si la ligne n’a pas de taxCodeId.",
            "Renseignez code SH / HS et catégorie, puis « Enregistrer le fiscal ».",
            "Dérogation : code + mode (Toujours / Jamais / Confirmer) + justification obligatoire.",
            "Jamais = exonération auditée (NEVER). Un NEVER client gagne sur un ALWAYS produit.",
            "Toujours n’active pas une règle PENDING_EXPERT. « Auto » retire la dérogation.",
          ],
          it: [
            "Scheda `/products/[id]` → sezione Fiscalità (sotto Identità prodotto).",
            "Scegli un’IVA predefinita (solo codici VAT) — fallback del motore se la riga non ha taxCodeId.",
            "Compila codice SH / HS e categoria, poi « Enregistrer le fiscal ».",
            "Deroga: codice + modalità (Toujours / Jamais / Confirmer) + giustificazione obbligatoria.",
            "Jamais = esenzione auditata (NEVER). Un NEVER cliente vince su un ALWAYS prodotto.",
            "Toujours non attiva una regola PENDING_EXPERT. « Auto » toglie la deroga.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de seed 4386 / 3 DT/kg / taxe fromage — classification seulement (D261).",
        "NEVER = exonération justifiée + audit. ALWAYS n’active pas PENDING_EXPERT. NEVER client prime ALWAYS produit.",
        "Pas de ligne SPECIFIC_TAX auto sur facture ce lot. taxCodeId reste obligatoire à la création facture.",
        "Taux = Fiscalité / Préférences VALIDATED — jamais inventés sur la fiche produit.",
      ],
      it: [
        "Nessun seed 4386 / 3 DT/kg / tassa formaggio — solo classificazione (D261).",
        "NEVER = esenzione giustificata + audit. ALWAYS non attiva PENDING_EXPERT. NEVER cliente batte ALWAYS prodotto.",
        "Nessuna riga SPECIFIC_TAX automatica in fattura in questo lotto. taxCodeId resta obbligatorio in creazione fattura.",
        "Aliquote = Fiscalità / Preferenze VALIDATED — mai inventate sulla scheda prodotto.",
      ],
    },
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
      fr: "Créances AR, factures, avoirs, encaissements, instruments, promesses, banque, factures fournisseurs AP, relances.",
      it: "Crediti AR, fatture, note di credito, incassi, strumenti, promesse, banca, fatture fornitori AP, solleciti.",
    },
    when: {
      fr: "Après livraison / facturation, pour encaisser et piloter le cash.",
      it: "Dopo consegna / fatturazione, per incassare e governare il cash.",
    },
    features: [
      {
        name: {
          fr: "Factures fournisseurs (AP)",
          it: "Fatture fornitori (AP)",
        },
        when: {
          fr: "Enregistrer une facture fournisseur sans référentiel (texte libre).",
          it: "Registrare una fattura fornitore senza anagrafica (testo libero).",
        },
        steps: {
          fr: [
            "Ouvrez `/finance/ap-bills` → « + Nouvelle facture fournisseur ».",
            "Chips Tout / Brouillon / Postée / Annulée — URL `?status=` partageable.",
            "Fournisseur = texte libre (D205) — pas de master obligatoire. HT + code TVA (stub TVA19) ou TTC sans lignes — jamais inventer un taux.",
            "Bandeau Expertise RAS/TEJ : consumers seulement si Prefs VALIDATED (D246).",
            "Sur la fiche : Poster (DRAFT → POSTED) freeze `tax_line` si lignes (D276) → GL Dr Achats HT / Dr TVA déductible / Cr Fournisseurs TTC via Thunder si Prefs `accounting.gl.vat_input` mappé ; sinon 2 lignes TTC (D273).",
            "POSTED → « Décaisser » : RAS déduit auto si Prefs VALIDATED ; paiement → Dr AP / Cr Banque (net). Split Cr RAS seulement si mapping `accounting.gl.ras` (D275) — jamais inventer le compte.",
            "Annuler une facture POSTÉE contrepasse le GL AP si écriture existante.",
            "Mapping comptes : `/accounting?tab=mapping` (401 / 601 / ACH · RAS + TVA déductible vides jusqu’à saisie).",
          ],
          it: [
            "Apri `/finance/ap-bills` → « + Nuova fattura fornitore ».",
            "Chip Tutti / Bozza / Registrata / Annullata — URL `?status=` condividibile.",
            "Fornitore = testo libero (D205) — anagrafica non obbligatoria. Imponibile + codice IVA (stub TVA19) o TTC senza righe — mai inventare un’aliquota.",
            "Fascia Expertise RAS/TEJ: consumer solo se Prefs VALIDATED (D246).",
            "In scheda: Registra (DRAFT → POSTED) freeze `tax_line` se righe (D276) → GL Dr Acquisti HT / Dr IVA detraibile / Cr Fornitori TTC via Thunder se Prefs `accounting.gl.vat_input` mappato; altrimenti 2 righe TTC (D273).",
            "POSTED → « Pagare »: RAS detratto auto se Prefs VALIDATED; pagamento → Dr AP / Cr Banca (netto). Split Cr RAS solo se mapping `accounting.gl.ras` (D275) — mai inventare il conto.",
            "Annullare una fattura POSTED storna il GL AP se scrittura esistente.",
            "Mapping conti: `/accounting?tab=mapping` (401 / 601 / ACH · RAS + IVA detraibile vuoti fino a input).",
          ],
        },
      },
      {
        name: {
          fr: "AUTHORITY X → facture AP",
          it: "AUTHORITY X → fattura AP",
        },
        when: {
          fr: "Commande desktop « Ahmed 1000 DT » → suggestion paiement fournisseur.",
          it: "Comando desktop « Ahmed 1000 DT » → suggerimento pagamento fornitore.",
        },
        steps: {
          fr: [
            "AUTHORITY X (CTRL+X) : saisir la commande → choisir l’entité si ambiguë.",
            "Assisted : valider → AUTHORITY ouvre `/finance/ap-bills` avec tiroir prérempli.",
            "Hotlink : ouverture directe AUTHORITY après le live log.",
            "Vérifier fournisseur / montant → Enregistrer (jamais d’écriture silencieuse).",
            "Pas de virement Treasury inventé — Transfer pending si workflow absent.",
          ],
          it: [
            "AUTHORITY X (CTRL+X): digita il comando → scegli l’entità se ambigua.",
            "Assisted: conferma → AUTHORITY apre `/finance/ap-bills` con drawer precompilato.",
            "Hotlink: apertura diretta AUTHORITY dopo il live log.",
            "Verifica fornitore / importo → Salva (mai scrittura silenziosa).",
            "Niente bonifico Treasury inventato — Transfer pending se workflow assente.",
          ],
        },
      },
      {
        name: {
          fr: "AUTHORITY X → encaissement AR",
          it: "AUTHORITY X → incasso AR",
        },
        when: {
          fr: "Commande desktop pour un client — suggestion Encaissement.",
          it: "Comando desktop per un cliente — suggerimento Incasso.",
        },
        steps: {
          fr: [
            "AUTHORITY X : commande avec client → « Encaissement client ».",
            "AUTHORITY ouvre `/finance/payments?create=1&…` (tiroir prérempli).",
            "Vérifier client / montant → Enregistrer (jamais silencieux).",
          ],
          it: [
            "AUTHORITY X: comando con cliente → « Incasso cliente ».",
            "AUTHORITY apre `/finance/payments?create=1&…` (drawer precompilato).",
            "Verifica cliente / importo → Salva (mai silenzioso).",
          ],
        },
      },
      {
        name: {
          fr: "Factures",
          it: "Fatture",
        },
        when: {
          fr: "Émettre une facture HT/TVA/TTC — TVA produit auto (stub TVA19 jusqu’au comptable).",
          it: "Emettere una fattura HT/IVA/TTC — IVA prodotto auto (stub TVA19 fino al commercialista).",
        },
        steps: {
          fr: [
            "Ouvrez `/finance/invoices` → « + Nouvelle facture ».",
            "Chips Tout / Brouillon / Émise / Annulée — URL `?status=` partageable.",
            "Choisissez un produit sur la ligne → TVA reprise (profil fiscal) ou stub TVA19 catalogue.",
            "Vous pouvez surcharger le code TVA manuellement ; hint « Stub » = à valider avec le comptable.",
            "Toggle Document : bon de livraison / facture — titre seulement.",
            "Sur la fiche : Émettre (DRAFT → ISSUED) ; Annuler / Avoir via overflow.",
            "FODEC/timbre : seulement si Prefs Expertise VALIDATED — pas inventés.",
          ],
          it: [
            "Apri `/finance/invoices` → « + Nuova fattura ».",
            "Chip Tutti / Bozza / Emessa / Annullata — URL `?status=` condividibile.",
            "Scegli un prodotto sulla riga → IVA dal profilo o stub TVA19 catalogo.",
            "Puoi sovrascrivere il codice IVA a mano ; hint « Stub » = da validare col commercialista.",
            "Toggle Documento: bolla / fattura — solo titolo.",
            "In scheda: Emetti (DRAFT → ISSUED); Annulla / Nota via overflow.",
            "FODEC/bollo: solo se Prefs Expertise VALIDATED — mai inventati.",
          ],
        },
      },
      {
        name: {
          fr: "Encaissements",
          it: "Incassi",
        },
        when: {
          fr: "Enregistrer un paiement client, l’affecter aux créances, contrepasser.",
          it: "Registrare un pagamento cliente, allocarlo ai crediti, stornare.",
        },
        steps: {
          fr: [
            "Ouvrez `/finance/payments` → « Nouveau paiement ».",
            "Chips Tout / Brouillon / Posté / Contrepassé — URL `?status=` partageable.",
            "Ligne → fiche AUTHORITY : montants, instruments, affectations.",
            "Sur la fiche : Affecter (politiques A–G) ; Contrepasser via overflow.",
            "GL via Thunder — ne jamais inventer de taux.",
          ],
          it: [
            "Apri `/finance/payments` → « Nuovo pagamento ».",
            "Chip Tutti / Bozza / Registrato / Stornato — URL `?status=` condividibile.",
            "Riga → scheda AUTHORITY: importi, strumenti, allocazioni.",
            "In scheda: Allocare (politiche A–G); Storna via overflow.",
            "GL via Thunder — non inventare tassi.",
          ],
        },
      },
      {
        name: {
          fr: "Déclarations portail",
          it: "Dichiarazioni portale",
        },
        when: {
          fr: "Le client a signalé un paiement depuis le portail — revue ADV avant encaissement.",
          it: "Il cliente ha segnalato un pagamento dal portale — revisione ADV prima dell’incasso.",
        },
        steps: {
          fr: [
            "Ouvrez `/finance/payment-declarations` (chips statut + recherche).",
            "Ouvrez la fiche → vérifiez montant / mode / référence.",
            "« Prendre en compte » ou « Refuser » (note optionnelle) — version optimistic lock.",
            "Ensuite créez l’encaissement dans `/finance/payments` si besoin.",
            "Jamais d’auto-création FinPayment depuis la déclaration (D243).",
          ],
          it: [
            "Apri `/finance/payment-declarations` (chip stato + ricerca).",
            "Apri la scheda → verifica importo / modo / riferimento.",
            "« Prendi in carico » o « Rifiuta » (nota opzionale) — lock versione.",
            "Poi crea l’incasso in `/finance/payments` se serve.",
            "Mai auto-creare FinPayment dalla dichiarazione (D243).",
          ],
        },
      },
      {
        name: {
          fr: "Avoirs",
          it: "Note di credito",
        },
        when: {
          fr: "Réduire une facture émise (partiel / total) sans restaurer le stock.",
          it: "Ridurre una fattura emessa (parziale / totale) senza ripristinare stock.",
        },
        steps: {
          fr: [
            "Ouvrez `/finance/credit-notes` → « + Nouvel avoir ».",
            "Chips Tout / Brouillon / Émis / Annulé — URL `?status=` partageable.",
            "Ligne → fiche AUTHORITY : lignes, HT/TVA/TTC, AR appliqué / non appliqué.",
            "Sur la fiche : Émettre (DRAFT) ; Annuler via overflow.",
            "FODEC/timbre seulement si Prefs VALIDATED — jamais inventer.",
          ],
          it: [
            "Apri `/finance/credit-notes` → « + Nuova nota ».",
            "Chip Tutti / Bozza / Emessa / Annullata — URL `?status=` condividibile.",
            "Riga → scheda AUTHORITY: righe, HT/IVA/TTC, AR applicato / non applicato.",
            "In scheda: Emetti (DRAFT); Annulla via overflow.",
            "FODEC/bollo solo se Prefs VALIDATED — non inventare.",
          ],
        },
      },
      {
        name: {
          fr: "Promesses & instruments",
          it: "Promesse e strumenti",
        },
        when: {
          fr: "Suivre un engagement client ou le cycle chèque/traite.",
          it: "Seguire un impegno cliente o il ciclo assegno/tratta.",
        },
        steps: {
          fr: [
            "`/finance/promises` — chips statut `?status=` · ligne → fiche · Annuler si OPEN.",
            "`/finance/instruments` — chips statut · ligne → fiche AUTHORITY (`GET /instruments/:id`).",
            "Sur la fiche instrument : transitions (déposé / présenté / encaissé / rejeté).",
            "Rejet = restauration AR — pas de blocage ventes sur promesse rompue.",
          ],
          it: [
            "`/finance/promises` — chip stato `?status=` · riga → scheda · Annulla se OPEN.",
            "`/finance/instruments` — chip stato · riga → scheda AUTHORITY (`GET /instruments/:id`).",
            "In scheda strumento: transizioni (depositato / presentato / incassato / rifiutato).",
            "Rifiuto = ripristino AR — niente blocco vendite su promessa rotta.",
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
            "`/finance/payments` — liste + fiche AUTHORITY (`?status=`) · Affecter / Contrepasser.",
            "`/finance/banking` — comptes, relevés CSV/OFX, rapprocher / ignorer.",
            "Décaissement AP : nom libre **ou** facture AP postée (lien D237).",
            "Si RAS déduite : retenue créée dans TEJ Center (`/tax/tej-center`) — valider / certificat / lot XML.",
            "Relancer : dunning human-gated (mailto / WA selon Prefs).",
          ],
          it: [
            "`/finance` — crediti aperti / scaduti.",
            "`/finance/payments` — lista + scheda AUTHORITY (`?status=`) · Allocare / Storna.",
            "`/finance/banking` — conti, estratti CSV/OFX, riconcilia / ignora.",
            "Pagamento AP: nome libero **o** fattura AP registrata (link D237).",
            "Se RAS detratta: ritenuta creata in TEJ Center (`/tax/tej-center`) — validare / certificato / lotto XML.",
            "Sollecito: dunning human-gated (mailto / WA secondo Prefs).",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "FODEC / timbre / RAS : Prefs VALIDATED uniquement.",
        "GL via Thunder — Finance ≠ inventer la compta.",
        "AP bills : vendorName libre · lien master `/suppliers` optionnel · lien payment optionnel · pont GL Thunder D273 (401/601/ACH).",
        "RAS auto déduit sur décaissement AP si Prefs VALIDATED (D264) · crée TaxWithholding CALCULATED (D283) · toggle exception · pas de TEJ transmission.",
        "Split GL RAS (D275) : Dr AP brut / Cr Banque net / Cr RAS — seulement si mapping `accounting.gl.ras` (vide = 2 lignes net, jamais inventer le compte).",
        "Lignes TVA AP (D276) : optionnelles · freeze à POSTED · split GL TVA déductible seulement si mapping `accounting.gl.vat_input` (vide = 2 lignes TTC, jamais seed 4366).",
        "Déclarations portail : pas d’auto FinPayment (D243).",
      ],
      it: [
        "FODEC / bollo / RAS: solo Prefs VALIDATED.",
        "GL via Thunder — Finanza ≠ inventare la contabilità.",
        "AP bills: vendorName libero · link master `/suppliers` opzionale · link payment opzionale · ponte GL Thunder D273 (401/601/ACH).",
        "RAS auto detratto su pagamento AP se Prefs VALIDATED (D264) · crea TaxWithholding CALCULATED (D283) · toggle eccezione · niente TEJ transmission.",
        "Split GL RAS (D275): Dr AP lordo / Cr Banca netto / Cr RAS — solo se mapping `accounting.gl.ras` (vuoto = 2 righe nette, mai inventare il conto).",
        "Righe IVA AP (D276): opzionali · freeze a POSTED · split GL IVA detraibile solo se mapping `accounting.gl.vat_input` (vuoto = 2 righe TTC, mai seed 4366).",
        "Dichiarazioni portale: niente auto FinPayment (D243).",
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
    locks: {
      fr: [
        "AUTHORITY D294 + Layout D225 — surfaces opaques, pas de cadres.",
        "Prefs GL mapping : jamais inventer / seed de codes métier.",
        "Finance ≠ Accounting (D072) — pont Thunder, pas de double saisie.",
        "RAS GL (D275) : compte vide jusqu’à humain — jamais seed 432x.",
        "TVA déductible AP (D276) : `accounting.gl.vat_input` vide jusqu’à humain — jamais seed 4366.",
      ],
      it: [
        "AUTHORITY D294 + Layout D225 — superfici opache, niente cornici.",
        "Prefs mapping GL: non inventare / seed codici.",
        "Finance ≠ Accounting (D072) — ponte Thunder, niente doppia imputazione.",
        "RAS GL (D275): conto vuoto fino a umano — mai seed 432x.",
        "IVA detraibile AP (D276): `accounting.gl.vat_input` vuoto fino a umano — mai seed 4366.",
      ],
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
            "Plan comptable : filtrez par code ou nom (401/601 seedés pour AP).",
            "Écritures : chips Tout / Brouillon / Postée / Contrepassée (`?status=`) + période.",
            "Ouvrez une fiche `/accounting/entries/:id` (lignes, poster / décomptabiliser).",
            "Mapping GL : AR + AP (Fournisseurs/Achats/journal ACH) + RAS à payer (D275) + TVA déductible AP (D276) — vides jusqu’à saisie.",
            "AP bill POSTÉ / décaissement → écriture GL via Thunder si module Accounting on. Split TVA déductible si mapping vat_input (D276) ; RAS split 3 lignes si mapping RAS (D275).",
            "Clôture / réouverture de période selon droits.",
          ],
          it: [
            "Apri `/accounting`.",
            "Piano dei conti: filtra per codice o nome (401/601 seed per AP).",
            "Registrazioni: chip Tutti / Bozza / Contabilizzata / Stornata (`?status=`) + periodo.",
            "Apri una scheda `/accounting/entries/:id` (righe, contabilizza / storna).",
            "Mapping GL: AR + AP (Fornitori/Acquisti/giornale ACH) + RAS da versare (D275) + IVA detraibile AP (D276) — vuoti fino a input.",
            "AP bill POSTED / pagamento → scrittura GL via Thunder se Accounting on. Split IVA detraibile se mapping vat_input (D276); RAS split 3 righe se mapping RAS (D275).",
            "Chiusura / riapertura periodo secondo permessi.",
          ],
        },
      },
      {
        name: {
          fr: "Fiche écriture AUTHORITY",
          it: "Scheda registrazione AUTHORITY",
        },
        when: {
          fr: "Contrôle détail lignes débit/crédit et actions post/reverse.",
          it: "Controllo dettaglio righe dare/avere e azioni contabilizza/storna.",
        },
        steps: {
          fr: [
            "Depuis la liste Écritures, cliquez N° ou Ouvrir.",
            "Consultez identité, source (lien facture si `fin_invoice`), totaux.",
            "Brouillon → Poster (primary). Postée → Décomptabiliser (crée reverse).",
            "Retour via overflow « Retour écritures ».",
          ],
          it: [
            "Dalla lista Registrazioni, clicca N° o Apri.",
            "Consulta identità, origine (link fattura se `fin_invoice`), totali.",
            "Bozza → Contabilizza (primary). Contabilizzata → Storna (crea reverse).",
            "Ritorno via overflow « Torna alle registrazioni ».",
          ],
        },
      },
    ],
  },
  {
    id: "tax",
    href: "/tax/tej-center",
    title: { fr: "Fiscalité", it: "Fiscalità" },
    summary: {
      fr: "TVA · RAS Engine · TEJ Center AUTHORITY (retenues → certificat → lot XML local) — Prefs VALIDATED only · transmission DISABLED.",
      it: "IVA · RAS Engine · TEJ Center AUTHORITY (ritenute → certificato → lotto XML locale) — solo Prefs VALIDATED · transmission DISABLED.",
    },
    when: {
      fr: "Catalogue TVA, hub retenues RAS, certificat local et lot XML TEJ (sans transmission).",
      it: "Catalogo IVA, hub ritenute RAS, certificato locale e lotto XML TEJ (senza trasmissione).",
    },
    features: [
      {
        name: {
          fr: "Calcul général & catalogue TVA",
          it: "Calcolo generale e catalogo IVA",
        },
        when: {
          fr: "Voir la pile HT→TVA→FODEC→timbre→TTC et RAS/TEJ Prefs.",
          it: "Vedere la pila HT→IVA→FODEC→bollo→TTC e RAS/TEJ Prefs.",
        },
        steps: {
          fr: [
            "Ouvrez `/tax` — bandeau Expertise FODEC/timbre/RAS/TEJ.",
            "Section Calcul général : statut Prefs par étape (VALIDATED ou en attente).",
            "Catalogue codes TVA 7/13/19/0 — consommés à l’émission facture.",
            "Saisie barèmes : Préférences › Expertise (groupe Fiscalité).",
            "Jamais inventer taux · TEJ sans transmission API.",
            "Moteur fiscal API `POST /tax/calculate` — règles PENDING_EXPERT = montant 0.",
            "Émission facture/avoir : snapshot `tax_line` figé (D263) — preview calculate ne persiste pas.",
            "Bouton TEJ Center (primaire) pour le hub retenues `/tax/tej-center`.",
          ],
          it: [
            "Apri `/tax` — fascia Expertise FODEC/bollo/RAS/TEJ.",
            "Sezione Calcolo generale: stato Prefs per passo (VALIDATED o in attesa).",
            "Catalogo codici IVA 7/13/19/0 — usati in emissione fattura.",
            "Inserimento aliquote: Preferenze › Expertise (gruppo Fiscalità).",
            "Mai inventare aliquote · TEJ senza trasmissione API.",
            "Motore fiscale API `POST /tax/calculate` — regole PENDING_EXPERT = importo 0.",
            "Emissione fattura/nota: snapshot `tax_line` congelato (D263) — preview calculate non persiste.",
            "Pulsante TEJ Center (primario) per l’hub ritenute `/tax/tej-center`.",
          ],
        },
      },
      {
        name: {
          fr: "TEJ Center — détection & validation RAS",
          it: "TEJ Center — rilevazione e validazione RAS",
        },
        when: {
          fr: "Créer et valider une retenue à la source (Prefs tax.ras VALIDATED).",
          it: "Creare e validare una ritenuta alla fonte (Prefs tax.ras VALIDATED).",
        },
        steps: {
          fr: [
            "Validez `tax.ras` dans Préférences › Expertise (jamais inventer ; stub démo ≠ Validé expert — D280).",
            "Ouvrez `/tax/tej-center` (⌘K « TEJ Center » ou bouton depuis `/tax`).",
            "Saisissez la période (ex. 2026-09) puis Actualiser — compteurs AUTHORITY.",
            "Nouvelle retenue → Fournisseur + Base TND → Détecter (preview) → Enregistrer.",
            "Statuts : DETECTED / CALCULATED — bouton Valider si non-stub et applicable.",
            "Stub STUB_UNTIL_EXPERT : calcul possible, validation bloquée jusqu’au remplacement Prefs.",
            "Transmission toujours DISABLED — aucun upload AUTHORITY→TEJ.",
          ],
          it: [
            "Validare `tax.ras` in Preferenze › Expertise (mai inventare; stub demo ≠ Validato expert — D280).",
            "Aprire `/tax/tej-center` (⌘K « TEJ Center » o pulsante da `/tax`).",
            "Inserire il periodo (es. 2026-09) poi Aggiorna — contatori AUTHORITY.",
            "Nuova ritenuta → Fornitore + Base TND → Rilevare (preview) → Registra.",
            "Stati: DETECTED / CALCULATED — pulsante Valida se non-stub e applicabile.",
            "Stub STUB_UNTIL_EXPERT: calcolo possibile, validazione bloccata fino a sostituzione Prefs.",
            "Trasmissione sempre DISABLED — nessun upload AUTHORITY→TEJ.",
          ],
        },
      },
      {
        name: {
          fr: "RAS sur factures clients (AR)",
          it: "RAS su fatture clienti (AR)",
        },
        when: {
          fr: "Activer le flag client puis émettre une facture — retenue dans TEJ Center.",
          it: "Attivare il flag cliente poi emettere una fattura — ritenuta in TEJ Center.",
        },
        steps: {
          fr: [
            "Fiche client → Fiscalité → « RAS sur factures clients (AR) » ON.",
            "Prefs `tax.ras` VALIDATED (jamais inventer ; stub bloque validate/certificat).",
            "Émettre la facture (`/finance/invoices/[id]` → Émettre).",
            "Retenue CALCULATED créée (side AR, liée à la facture) — montants facture inchangés.",
            "Bandeau AUTHORITY facture → TEJ Center · XML facture (si Certificat prêt).",
            "TEJ Center : filtre Clients · Préparer lot XML (période) ou XML facture (ligne).",
          ],
          it: [
            "Scheda cliente → Fiscalità → « RAS su fatture clienti (AR) » ON.",
            "Prefs `tax.ras` VALIDATED (mai inventare; stub blocca validate/certificato).",
            "Emettere la fattura (`/finance/invoices/[id]` → Emetti).",
            "Ritenuta CALCULATED creata (side AR, collegata alla fattura) — importi fattura invariati.",
            "Fascia AUTHORITY fattura → TEJ Center · XML fattura (se Certificato pronto).",
            "TEJ Center: filtro Clienti · Prepara lotto XML (periodo) o XML fattura (riga).",
          ],
        },
      },
      {
        name: {
          fr: "Retenue auto depuis décaissement AP",
          it: "Ritenuta auto da pagamento AP",
        },
        when: {
          fr: "Un paiement fournisseur avec RAS crée la retenue dans TEJ Center.",
          it: "Un pagamento fornitore con RAS crea la ritenuta in TEJ Center.",
        },
        steps: {
          fr: [
            "Sur une facture AP POSTED : Décaissement lié — montant base avant RAS.",
            "Si Prefs `tax.ras` VALIDATED : toggle « Déduire RAS automatiquement » (défaut on).",
            "À l’enregistrement : net versé + montant RAS figés ; retenue CALCULATED créée (même transaction).",
            "Lien AUTHORITY « Ouvrir TEJ Center » après succès pour valider / certificat.",
            "Une seule retenue par décaissement (idempotent) — pas de doublon.",
            "Sans Prefs VALIDATED : pas de RAS inventée, pas de retenue créée.",
          ],
          it: [
            "Su fattura AP POSTED: Pagamento collegato — importo base prima RAS.",
            "Se Prefs `tax.ras` VALIDATED: toggle « Detrai RAS automaticamente » (default on).",
            "Alla registrazione: netto versato + importo RAS fissati; ritenuta CALCULATED creata (stessa transazione).",
            "Link AUTHORITY « Apri TEJ Center » dopo successo per validare / certificato.",
            "Una sola ritenuta per pagamento (idempotente) — nessun duplicato.",
            "Senza Prefs VALIDATED: nessuna RAS inventata, nessuna ritenuta creata.",
          ],
        },
      },
      {
        name: {
          fr: "Certificat RAS local",
          it: "Certificato RAS locale",
        },
        when: {
          fr: "Émettre une attestation interne après validation humaine.",
          it: "Emettere un’attestazione interna dopo validazione umana.",
        },
        steps: {
          fr: [
            "Sur `/tax/tej-center`, ligne statut Validée → bouton Certificat.",
            "Génère une attestation texte + empreinte SHA-256 ; statut → Certificat prêt.",
            "Numéro local `RAS-CERT-YYYY-####` (série AUTHORITY — pas un n° MF officiel).",
            "Téléchargement `.txt` local — marquage AUTHORITY_LOCAL_CERTIFICATE.",
            "Ce n’est pas un formulaire officiel MF ; ne remplace pas une pièce fiscale légale.",
            "Stub : certificat impossible tant que Prefs tax.ras n’est pas remplacé.",
            "Re-téléchargement possible sur statut Certificat prêt (idempotent).",
          ],
          it: [
            "Su `/tax/tej-center`, riga stato Validata → pulsante Certificato.",
            "Genera attestazione testo + hash SHA-256; stato → Certificato pronto.",
            "Numero locale `RAS-CERT-YYYY-####` (serie AUTHORITY — non un n° MF ufficiale).",
            "Download `.txt` locale — marcatura AUTHORITY_LOCAL_CERTIFICATE.",
            "Non è un modulo ufficiale MF; non sostituisce un documento fiscale legale.",
            "Stub: certificato impossibile finché Prefs tax.ras non è sostituito.",
            "Ri-download possibile su stato Certificato pronto (idempotente).",
          ],
        },
      },
      {
        name: {
          fr: "Lot XML TEJ local (retenues)",
          it: "Lotto XML TEJ locale (ritenute)",
        },
        when: {
          fr: "Packager les retenues Certificat prêt d’une période en XML local.",
          it: "Impacchettare le ritenute Certificato pronto di un periodo in XML locale.",
        },
        steps: {
          fr: [
            "Validez Prefs `tax.tej` (params déclarant locaux) — jamais inventer.",
            "Sur `/tax/tej-center` : période renseignée + au moins une retenue Certificat prêt.",
            "Filtre Tous / Fournisseurs / Clients pour cibler le lot (AP, AR ou mixte).",
            "Bouton primaire « Préparer lot XML » → download XML WITHHOLDING_PACK + SHA-256.",
            "Ou ligne AR « XML facture » / bandeau facture → pack par `arInvoiceId`.",
            "Les lignes passent en TEJ_PREPARED et sont liées au lot.",
            "Ensuite : Accusé import → Accepté/Rejeté Tej → Archiver (cycle local D287).",
            "Schéma = AUTHORITY_LOCAL_DRAFT@1 (registry D293) — pas un XSD TEJ officiel ; ne pas uploader via AUTHORITY.",
            "Transmission DISABLED forever côté AUTHORITY jusqu’à unlock produit + XSD fourni.",
          ],
          it: [
            "Validare Prefs `tax.tej` (parametri dichiarante locali) — mai inventare.",
            "Su `/tax/tej-center`: periodo impostato + almeno una ritenuta Certificato pronto.",
            "Filtro Tutti / Fornitori / Clienti per mirare il lotto (AP, AR o misto).",
            "Pulsante primario « Prepara lotto XML » → download XML WITHHOLDING_PACK + SHA-256.",
            "O riga AR « XML fattura » / fascia fattura → pack per `arInvoiceId`.",
            "Le righe passano a TEJ_PREPARED e sono collegate al lotto.",
            "Poi: Ricevuta import → Accettato/Rifiutato Tej → Archivia (ciclo locale D287).",
            "Schema = AUTHORITY_LOCAL_DRAFT@1 (registry D293) — non un XSD TEJ ufficiale; non caricare via AUTHORITY.",
            "Trasmissione DISABLED forever lato AUTHORITY fino a unlock prodotto + XSD fornito.",
          ],
        },
      },
      {
        name: {
          fr: "Accusé import Tej & résultat (local)",
          it: "Ricevuta import Tej e esito (locale)",
        },
        when: {
          fr: "Après import manuel du XML dans Tej — enregistrer l’accusé puis l’acceptation/rejet.",
          it: "Dopo import manuale XML in Tej — registrare ricevuta poi accettazione/rifiuto.",
        },
        steps: {
          fr: [
            "Importer le XML téléchargé dans la plateforme Tej (hors AUTHORITY).",
            "Sur `/tax/tej-center`, ligne TEJ préparé → « Accusé import » (statut Import Tej accusé).",
            "Quand Tej répond : « Accepté Tej » ou « Rejeté Tej » (motif obligatoire si rejet).",
            "Puis « Archiver » pour clôturer la retenue.",
            "AUTHORITY n’upload jamais vers Tej — cycle 100 % local / humain.",
          ],
          it: [
            "Importare l’XML scaricato nella piattaforma Tej (fuori AUTHORITY).",
            "Su `/tax/tej-center`, riga TEJ preparato → « Ricevuta import » (stato Import Tej accusato).",
            "Quando Tej risponde: « Accettato Tej » o « Rifiutato Tej » (motivo obbligatorio se rifiuto).",
            "Poi « Archivia » per chiudere la ritenuta.",
            "AUTHORITY non carica mai verso Tej — ciclo 100 % locale / umano.",
          ],
        },
      },
      {
        name: {
          fr: "TEJ brouillon meta (sans retenues)",
          it: "TEJ bozza meta (senza ritenute)",
        },

        when: {
          fr: "Générer un XML meta vide depuis `/tax` (historique hash).",
          it: "Generare un XML meta vuoto da `/tax` (storico hash).",
        },
        steps: {
          fr: [
            "Validez `tax.tej` dans Préférences › Expertise.",
            "Sur `/tax` → section « TEJ — brouillon local ».",
            "Saisissez une période → Générer brouillon (packKind META_DRAFT, 0 retenues).",
            "Pour un lot avec retenues, préférez TEJ Center « Préparer lot XML ».",
            "Transmission toujours DISABLED — pas d’upload ni d’API fiscale.",
          ],
          it: [
            "Validare `tax.tej` in Preferenze › Expertise.",
            "Su `/tax` → sezione « TEJ — brouillon local ».",
            "Inserire un periodo → Genera bozza (packKind META_DRAFT, 0 ritenute).",
            "Per un lotto con ritenute, preferire TEJ Center « Prepara lotto XML ».",
            "Trasmissione sempre DISABLED — nessun upload né API fiscale.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "FODEC / timbre / RAS / TEJ : Prefs VALIDATED only.",
        "tax_line frozen on ISSUED only (D263) — never recalculate after rate change.",
        "Pipeline RAS AUTHORITY : DETECTED/CALCULATED → VALIDATED → CERTIFICATE_READY → TEJ_PREPARED.",
        "Stub STUB_UNTIL_EXPERT bloque validate et certificat (D280).",
        "Décaissement AP RAS → TaxWithholding 1:1 idempotent (D283).",
        "Facture client ISSUED + flag RAS AR → TaxWithholding AR (D286) — totaux facture inchangés.",
        "Certificat = attestation interne AUTHORITY_LOCAL_CERTIFICATE + n° RAS-CERT-YYYY-#### — pas formulaire MF.",
        "Lot XML = AUTHORITY_LOCAL_DRAFT WITHHOLDING_PACK (période ou par facture) — pas XSD officiel · pas transmission.",
        "Après import manuel Tej : Accusé import → Accepté/Rejeté → Archiver (D287) — pas d’upload AUTHORITY.",
        "TEJ transmission pretend interdite jusqu’à unlock + XSD MF fourni.",
        "Règle fiscale ACTIVE seulement après validation expert (D259).",
      ],
      it: [
        "FODEC / bollo / RAS / TEJ: solo Prefs VALIDATED.",
        "tax_line congelato solo su ISSUED (D263) — mai ricalcolare dopo cambio aliquota.",
        "Pipeline RAS AUTHORITY: DETECTED/CALCULATED → VALIDATED → CERTIFICATE_READY → TEJ_PREPARED.",
        "Stub STUB_UNTIL_EXPERT blocca validate e certificato (D280).",
        "Pagamento AP RAS → TaxWithholding 1:1 idempotente (D283).",
        "Certificato = attestazione interna AUTHORITY_LOCAL_CERTIFICATE + n° RAS-CERT-YYYY-#### — non modulo MF.",
        "Lotto XML = AUTHORITY_LOCAL_DRAFT WITHHOLDING_PACK — no XSD ufficiale · no transmission.",
        "TEJ transmission pretend vietata fino a unlock + XSD MF fornito.",
        "Regola fiscale ACTIVE solo dopo validazione esperto (D259).",
      ],
    },
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
            "CONFIRMED → « Export SEPA » = pain.001.001.03 (RIB→IBAN TN, BIC NOTPROVIDED).",
            "RIB société obligatoire sur le compte banque pour l’export.",
            "Jamais inventer taux CNSS/IRPP/TFP · pas d’auto-envoi banque.",
          ],
          it: [
            "Genera / consulta la busta; PDF server se disponibile.",
            "Ordine bonifico: DRAFT → conferma ADV → pagamento bancario soft.",
            "CONFIRMED → « Export SEPA » = pain.001.001.03 (RIB→IBAN TN, BIC NOTPROVIDED).",
            "RIB azienda obbligatorio sul conto banca per l’export.",
            "Mai inventare aliquote CNSS/IRPP/TFP · niente invio automatico banca.",
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
      {
        name: {
          fr: "Fiches digitales Prep→Pesage→Contrôle (D292)",
          it: "Schede digitali Prep→Pesatura→Controllo (D292)",
        },
        when: {
          fr: "Préparer, peser manuellement et contrôler une ligne avant suite livraison.",
          it: "Preparare, pesare manualmente e controllare una riga prima della consegna.",
        },
        steps: {
          fr: [
            "`/production/worksheets` → Nouvelle fiche (produit + qté demandée).",
            "Préparer → saisir qté préparée → Confirmer.",
            "Peser → saisir qté pesée manuelle (pas de balance Devices) → Confirmer.",
            "Contrôler → OK ou Rejeter (motif obligatoire).",
            "Events outbox only — pas d’OF auto · pas de facturation · Print/TSC = V5.",
          ],
          it: [
            "`/production/worksheets` → Nuova scheda (prodotto + qtà richiesta).",
            "Preparare → qtà preparata → Conferma.",
            "Pesare → qtà pesata manuale (niente bilancia Devices) → Conferma.",
            "Controllare → OK o Rifiuta (motivo obbligatorio).",
            "Solo eventi outbox — niente OF auto · niente fatturazione · Print/TSC = V5.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pesage manuel V4 — pas Devices / TSC.",
        "Pas d’impact facture / stock sur transitions fiche.",
        "Pas d’OF auto depuis commande (D290 hint only).",
      ],
      it: [
        "Pesatura manuale V4 — niente Devices / TSC.",
        "Nessun impatto fattura / scorte sulle transizioni scheda.",
        "Niente OF auto da ordine (solo hint D290).",
      ],
    },
  },
  {
    id: "analytics",
    href: "/analytics",
    title: { fr: "Analytics", it: "Analytics" },
    summary: {
      fr: "Synthèse live — agrégats réels Sales / Finance / Stock / Livraison (pas de KPI inventés).",
      it: "Sintesi live — aggregati reali Sales / Finance / Scorte / Consegne (niente KPI inventati).",
    },
    when: {
      fr: "Vue transverse des compteurs métier déjà présents dans Mission Control.",
      it: "Vista trasversale dei contatori business già in Mission Control.",
    },
    features: [
      {
        name: {
          fr: "Synthèse live (D293)",
          it: "Sintesi live (D293)",
        },
        when: {
          fr: "Lire les compteurs sans cube BI persisté.",
          it: "Leggere i contatori senza cube BI persistito.",
        },
        steps: {
          fr: [
            "Ouvrez `/analytics` (module Analytics activé).",
            "Sections = modules sources ON uniquement (sinon badge « désactivé »).",
            "Montants TND = encours AR as-recorded — jamais inventés.",
            "Actualiser pour recharger · Mission Control garde ses home-kpis.",
          ],
          it: [
            "Apri `/analytics` (modulo Analytics attivo).",
            "Sezioni = solo moduli sorgente ON (altrimenti badge « disattivato »).",
            "Importi TND = crediti AR as-recorded — mai inventati.",
            "Aggiorna per ricaricare · Mission Control mantiene i home-kpis.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de KPI inventés / CA fictif.",
        "Pas de snapshot cube persisté V0 · pas d’IA.",
        "TEJ XSD officiel reste bloqué jusqu’à artefact MF (registry swap-ready).",
      ],
      it: [
        "Niente KPI inventati / fatturato fittizio.",
        "Niente snapshot cube persistito V0 · niente IA.",
        "XSD TEJ ufficiale resta bloccato fino ad artefatto MF (registry swap-ready).",
      ],
    },
  },
  {
    id: "automation",
    href: "/automation",
    title: { fr: "Automatisation", it: "Automazione" },
    summary: {
      fr: "Profils ASSISTED / Approbation — suggestions human-gated (manuel ou events Thunder), pas de FULL_AUTO critique.",
      it: "Profili ASSISTED / Approvazione — suggerimenti human-gated (manuale o eventi Thunder), niente FULL_AUTO critico.",
    },
    when: {
      fr: "Piloter des suggestions (créances échues, déclarations portail, brouillons, lot TEJ, commande confirmée).",
      it: "Guidare suggerimenti (crediti scaduti, dichiarazioni portale, bozze, lotto TEJ, ordine confermato).",
    },
    features: [
      {
        name: {
          fr: "Profils et exécutions",
          it: "Profili ed esecuzioni",
        },
        when: {
          fr: "Créer un profil, l’exécuter, approuver / refuser une suggestion.",
          it: "Creare un profilo, eseguirlo, approvare / rifiutare un suggerimento.",
        },
        steps: {
          fr: [
            "Ouvrez `/automation` → « Nouveau profil ».",
            "Choisissez mode Assisté ou Approbation (FULL_AUTO bloqué).",
            "« Exécuter » crée un run SUGGESTED / PENDING — aucune mutation métier.",
            "Sur la fiche : Approuver / Refuser (acknowledgement seulement).",
            "Shadow = log SKIPPED sans suggestion active.",
          ],
          it: [
            "Apri `/automation` → « Nuovo profilo ».",
            "Scegli Assistito o Approvazione (FULL_AUTO bloccato).",
            "« Esegui » crea un run SUGGESTED / PENDING — nessuna mutazione.",
            "In scheda: Approva / Rifiuta (solo acknowledgement).",
            "Shadow = log SKIPPED senza suggerimento attivo.",
          ],
        },
      },
      {
        name: {
          fr: "Suggestions via Thunder (events)",
          it: "Suggerimenti via Thunder (eventi)",
        },
        when: {
          fr: "Un événement métier crée automatiquement un run ASSISTED (idempotent).",
          it: "Un evento business crea automaticamente un run ASSISTED (idempotente).",
        },
        steps: {
          fr: [
            "Activez un profil pour le déclencheur concerné (ex. Lot TEJ XML préparé + Hint import Tej).",
            "Events : déclaration portail · créance AR créée (si déjà échue) · draft WA · lot TEJ préparé · commande confirmée.",
            "Thunder consumer `automation.suggestFromEvent` → run badge Event.",
            "Toujours zéro mutation — Approuver ≠ exécuter le métier.",
            "Pas d’upload TEJ · pas de confirm commande auto · pas de FinPayment · pas d’OF auto.",
          ],
          it: [
            "Attivare un profilo per il trigger (es. Lotto TEJ XML preparato + Hint import Tej).",
            "Eventi: dichiarazione portale · credito AR creato (se già scaduto) · draft WA · lotto TEJ · ordine confermato.",
            "Consumer Thunder `automation.suggestFromEvent` → run badge Event.",
            "Sempre zero mutazioni — Approvare ≠ eseguire il business.",
            "Niente upload TEJ · niente confirm ordine auto · niente FinPayment · niente OF auto.",
          ],
        },
      },
      {
        name: {
          fr: "Hint besoin production (D290)",
          it: "Hint fabbisogno produzione (D290)",
        },
        when: {
          fr: "Après confirmation commande — suggérer un OF manuel si Production est actif.",
          it: "Dopo conferma ordine — suggerire un OF manuale se Production è attivo.",
        },
        steps: {
          fr: [
            "Profil : déclencheur « Commande confirmée » + action « Hint besoin production ».",
            "Event `sales.order.confirmed.v1` → run ASSISTED (badge Event) + signal Thunder + cloche PROD_NEED.",
            "Ouvrir `/production` et créer l’OF manuellement si besoin.",
            "Thunder ne crée jamais d’OF automatiquement.",
          ],
          it: [
            "Profilo: trigger « Ordine confermato » + azione « Hint fabbisogno produzione ».",
            "Evento `sales.order.confirmed.v1` → run ASSISTED (badge Event) + segnale Thunder + campana PROD_NEED.",
            "Aprire `/production` e creare l’OF manualmente se serve.",
            "Thunder non crea mai OF automaticamente.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "FULL_AUTO interdit V0 (D245/D289/D290).",
        "Pas de confirm commande / FinPayment / draft dunning auto / upload TEJ / OF auto.",
        "Approuver ≠ exécuter la mutation métier.",
        "Thunder orchestre seulement des suggestions (HOW).",
      ],
      it: [
        "FULL_AUTO vietato V0 (D245/D289/D290).",
        "Niente confirm ordine / FinPayment / draft sollecito auto / upload TEJ / OF auto.",
        "Approvare ≠ eseguire la mutazione business.",
        "Thunder orchestra solo suggerimenti (HOW).",
      ],
    },
  },
  {
    id: "forge",
    href: "/forge",
    title: { fr: "FORGE", it: "FORGE" },
    summary: {
      fr: "Fondation d’extensions tenant — manifests, demandes, métadonnées. Pas d’agent IA en Phase 1.",
      it: "Fondazione estensioni tenant — manifest, richieste, metadata. Nessun agente IA in Fase 1.",
    },
    when: {
      fr: "Enregistrer une extension ou une demande de fonctionnalité spécifique au tenant.",
      it: "Registrare un’estensione o una richiesta di funzionalità specifica del tenant.",
    },
    features: [
      {
        name: {
          fr: "Vue d’ensemble · Extensions · Demandes · Métadonnées",
          it: "Panoramica · Estensioni · Richieste · Metadati",
        },
        when: {
          fr: "Piloter le lifecycle DRAFT → … → ACTIVE et le pont AUTHORITY.",
          it: "Governare il lifecycle DRAFT → … → ACTIVE e il ponte AUTHORITY.",
        },
        steps: {
          fr: [
            "Activez le module `forge` (seed ENABLED démo) et droits `forge.read` / `write` / `approve`.",
            "Ouvrez `/forge` — compteurs extensions / demandes / métadonnées · IA & sandbox UNAVAILABLE.",
            "`/forge/extensions` → Nouvelle extension (clé + version) → statut DRAFT.",
            "Transitions write : Analyser… ; Approuver / Activer exigent `forge.approve`.",
            "`/forge/feature-requests` → intake humain — aucune implémentation auto.",
            "`/forge/metadata` → définition DRAFT (clé, type, module, commandId optionnel) → Activer pour le pont ⌘K.",
          ],
          it: [
            "Attiva il modulo `forge` (seed ENABLED demo) e permessi `forge.read` / `write` / `approve`.",
            "Apri `/forge` — contatori estensioni / richieste / metadati · IA & sandbox UNAVAILABLE.",
            "`/forge/extensions` → Nuova estensione (chiave + versione) → stato DRAFT.",
            "Transizioni write: Analizza… ; Approva / Attiva richiedono `forge.approve`.",
            "`/forge/feature-requests` → intake umano — nessuna implementazione auto.",
            "`/forge/metadata` → definizione DRAFT (chiave, tipo, modulo, commandId opzionale) → Attiva per il ponte ⌘K.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "AUTHORITY D294 — un accent, surfaces opaques, pas de 2ᵉ design system.",
        "Pas d’exécution de code / sandbox / agent IA.",
        "Extensions : DRAFT → ACTIVE interdit sans APPROVED.",
        "Métadonnées ACTIVE + schemaJson.commandId enrichissent ⌘K — pas de 2ᵉ ActionRegistry.",
      ],
      it: [
        "AUTHORITY D294 — un accento, superfici opache, niente secondo design system.",
        "Niente esecuzione codice / sandbox / agente IA.",
        "Estensioni: DRAFT → ACTIVE vietato senza APPROVED.",
        "Metadati ACTIVE + schemaJson.commandId arricchiscono ⌘K — niente secondo ActionRegistry.",
      ],
    },
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
      fr: "Configuration Admin — stubs opérationnels STUB_UNTIL_EXPERT (D272) jusqu’au comptable.",
      it: "Configurazione Admin — stub operativi STUB_UNTIL_EXPERT (D272) fino al commercialista.",
    },
    features: [
      {
        name: {
          fr: "Expertise & Envois",
          it: "Expertise e Invii",
        },
        when: {
          fr: "FODEC/timbre/TEJ/CNSS (stubs demo) + RAS + SMTP / WhatsApp dunning.",
          it: "FODEC/bollo/TEJ/CNSS (stub demo) + RAS + SMTP / WhatsApp dunning.",
        },
        steps: {
          fr: [
            "Ouvrez `/settings` — compartiments AUTHORITY.",
            "Expertise : seed démo = badge « Stub démo · à remplacer » (STUB_UNTIL_EXPERT) — pas « Validé expert » ; RAS/IRPP/TFP restent vides (D272/D280).",
            "Remplacer un stub : réf. légale réelle sans STUB_UNTIL_EXPERT → Remplacer stub · audit stub_replaced.",
            "RAS reste vide jusqu’à saisie expert ; TEJ = brouillon XML local sur `/tax` (D265) — transmission toujours DISABLED.",
            "Envois : host SMTP, tester l’envoi si configuré.",
            "Modes : code unlock SPECTRE/PATCH/GHOST.",
            "Poste : AUTHORITY X — générer un code d’appairage (10 min) puis coller dans le companion.",
          ],
          it: [
            "Apri `/settings` — compartimenti AUTHORITY.",
            "Expertise: seed demo = badge « Stub demo · da sostituire » (STUB_UNTIL_EXPERT) — non « Validato expert »; RAS/IRPP/TFP restano vuoti (D272/D280).",
            "Sostituire uno stub: rif. legale reale senza STUB_UNTIL_EXPERT → Sostituisci stub · audit stub_replaced.",
            "RAS resta vuoto fino a input esperto; TEJ = bozza XML locale su `/tax` (D265) — trasmissione sempre DISABLED.",
            "Invii: host SMTP, testa invio se configurato.",
            "Modalità: codice unlock SPECTRE/PATCH/GHOST.",
            "Postazione: AUTHORITY X — genera un codice di associazione (10 min) poi incollalo nel companion.",
          ],
        },
      },
      {
        name: {
          fr: "AUTHORITY X — appairage",
          it: "AUTHORITY X — associazione",
        },
        when: {
          fr: "Quand le companion desktop doit appeler l’API (intent Thunder) sans cookie navigateur.",
          it: "Quando il companion desktop deve chiamare l’API (intent Thunder) senza cookie browser.",
        },
        steps: {
          fr: [
            "Ouvrez `/settings#poste`.",
            "Cliquez « Générer un code » (session AUTHORITY requise).",
            "Dans AUTHORITY X, collez le code XXXX-XXXX (10 min).",
            "Le jeton `axd_` est stocké dans le keyring OS (safeStorage) — révoquez ici pour déconnecter.",
          ],
          it: [
            "Apri `/settings#poste`.",
            "Clicca « Genera un codice » (sessione AUTHORITY richiesta).",
            "In AUTHORITY X, incolla il codice XXXX-XXXX (10 min).",
            "Il token `axd_` è nel keyring OS (safeStorage) — revoca qui per disconnettere.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Ne jamais inventer ni seed de taux tunisiens.",
        "Consumers métier seulement si VALIDATED.",
        "TEJ : brouillon local + hash (D265) — jamais transmission.",
        "AUTHORITY X : appairage depuis session AUTHORITY seulement — jeton hashé, jamais silent write.",
        "Mapping GL TVA déductible (D276) : `accounting.gl.vat_input` vide jusqu’à humain — jamais seed 4366.",
      ],
      it: [
        "Mai inventare né seed di aliquote tunisine.",
        "Consumer operativi solo se VALIDATED.",
        "TEJ: bozza locale + hash (D265) — mai trasmissione.",
        "AUTHORITY X: associazione solo da sessione AUTHORITY — token hashato, mai silent write.",
        "Mapping GL IVA detraibile (D276): `accounting.gl.vat_input` vuoto fino a umano — mai seed 4366.",
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
      fr: "Employee Portal : accueil KPI, congés (annuler), calendrier, bulletins, documents, profil. Customer Portal : commandes / docs (shell séparé).",
      it: "Employee Portal: home KPI, congedi (annulla), calendario, buste, documenti, profilo. Customer Portal: ordini / doc (shell separato).",
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
            "Accueil : KPI demandes / bulletins / documents.",
            "Congés : demander, suivre, annuler une demande REQUESTED ; calendrier.",
            "Bulletins : consulter / PDF (own only — IDOR→404).",
            "Documents : télécharger le dossier RH lié.",
            "Profil : lecture seule identité · RIB éditable (validation TN).",
          ],
          it: [
            "Login `/employee-portal/login`.",
            "Home: KPI richieste / buste / documenti.",
            "Congedi: richiedere, seguire, annullare una REQUESTED; calendario.",
            "Buste: consultare / PDF (own only — IDOR→404).",
            "Documenti: scaricare il dossier RH collegato.",
            "Profilo: identità sola lettura · RIB modificabile (validazione TN).",
          ],
        },
      },
      {
        name: {
          fr: "Customer Portal AUTHORITY",
          it: "Customer Portal AUTHORITY",
        },
        when: {
          fr: "Self-service client B2B — commandes, livraisons, finance, docs.",
          it: "Self-service cliente B2B — ordini, consegne, finanza, documenti.",
        },
        steps: {
          fr: [
            "Connexion `/portal/login` (cookie realm distinct).",
            "Accueil : KPI AUTHORITY + alertes.",
            "Commandes / Livraisons / Finance / Réclamations / Documents / Salubrité.",
            "Finance → « Déclarer un paiement » : signalement ADV (pas d’encaissement auto).",
            "Nouvelle commande = CTA primary ; listes = ASoftTable (zéro cadre).",
            "Nav shell = underline quiet (aligné Employee Portal / D228).",
          ],
          it: [
            "Login `/portal/login` (cookie realm distinto).",
            "Home: KPI AUTHORITY + avvisi.",
            "Ordini / Consegne / Finanza / Reclami / Documenti / Salubrità.",
            "Finanza → « Dichiarare un pagamento »: segnalazione ADV (niente incasso auto).",
            "Nuovo ordine = CTA primary; liste = ASoftTable (zero cornici).",
            "Nav shell = underline quiet (allineato Employee Portal / D228).",
          ],
        },
      },
      {
        name: {
          fr: "Déclaration de paiement (portail)",
          it: "Dichiarazione di pagamento (portale)",
        },
        when: {
          fr: "Vous avez déjà payé et voulez informer l’ADV.",
          it: "Hai già pagato e vuoi informare l’ADV.",
        },
        steps: {
          fr: [
            "`/portal/finance` → « Déclarer un paiement » (ou `/portal/finance/payment-declarations/new`).",
            "Montant TND, mode, date, référence / notes optionnels, créance optionnelle.",
            "Soumettre → statut Soumise ; annulation possible tant que Soumise.",
            "L’ADV prend en compte ou refuse — l’encaissement se fait côté ADV séparément.",
          ],
          it: [
            "`/portal/finance` → « Dichiarare un pagamento » (o `/portal/finance/payment-declarations/new`).",
            "Importo TND, modo, data, riferimento / note opzionali, credito opzionale.",
            "Invia → stato Inviata; annullabile finché Inviata.",
            "L’ADV prende in carico o rifiuta — l’incasso è separato lato ADV.",
          ],
        },
      },
    ],
    locks: {
      fr: [
        "Pas de soldes / quotas inventés.",
        "Pas de pointage ni virement depuis le portail (lots ultérieurs).",
        "Déclaration paiement : pas d’auto FinPayment / allocation (D243).",
        "RIB : checksum structurel seulement (pas d’existence compte inventée).",
        "Customer Portal : AUTHORITY D294 + Layout D225 — pas de second look.",
      ],
      it: [
        "Nessun saldo / quota inventato.",
        "Niente timbratura né bonifico dal portale (lotti successivi).",
        "Dichiarazione pagamento: niente auto FinPayment / allocazione (D243).",
        "RIB: solo checksum strutturale (nessuna esistenza conto inventata).",
        "Customer Portal: AUTHORITY D294 + Layout D225 — niente secondo look.",
      ],
    },
  },
];

export function helpText(
  locale: HelpLocale,
  pair: { fr: string; it: string },
): string {
  return locale === "it" ? pair.it : pair.fr;
}

/** Canonical FR action labels — Layout Constitution D225. */
export const LAYOUT_ACTIONS = {
  newOrder: "+ Nouvelle commande",
  newCustomer: "+ Nouveau client",
  newSupplier: "+ Nouveau fournisseur",
  newProduct: "+ Nouveau produit",
  newInvoice: "+ Nouvelle facture",
  newApBill: "+ Nouvelle facture fournisseur",
  newEmployee: "+ Nouvel employé",
  newCreditNote: "+ Nouvel avoir",
  save: "Enregistrer",
  edit: "Modifier",
  validate: "Valider",
  cancel: "Annuler",
  delete: "Supprimer",
  print: "Imprimer",
  export: "Exporter",
  assign: "Assigner",
  confirm: "Confirmer",
  close: "Clôturer",
  more: "•••",
} as const;

export type LayoutActionKey = keyof typeof LAYOUT_ACTIONS;

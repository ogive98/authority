# AUTHORITY X

Desktop companion Soft Glass — **not** an ERP module.

## Phases

| Phase | Status |
|-------|--------|
| 2–5 | Done — shell · engine · Thunder · AP workflow · solid unit UI |
| **6** | **Done** — AR encaissement prefill · Cut-safe CTRL+X · ⌃X/Cut toggles |

## Run

```bash
npm run dev -w authority-x   # tray + CTRL+X + summon :17898
```

Soft Glass + API in parallel (`npm run dev`).

## Flow

```text
CTRL+X → commande → pick entity
  → Encaissement client  → /finance/payments?create=1&…
  → Paiement fournisseur → /finance/ap-bills?create=1&…
  → Soft Glass drawer prérempli → human Enregistrer
```

**Cut-safe ON** (défaut) : dans un champ Edit Win32, CTRL+X = Couper (X ne vole pas). Tray / boutons ⌃X · Cut.

**Transfer** = Banque Soft Glass only (`Treasury pending`) — pas de CREATE_TRANSFER inventé.

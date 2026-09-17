# AUTHORITY X

Desktop companion for the AUTHORITY web shell — **not** an ERP module.

## Phases

| Phase | Status |
|-------|--------|
| 2–5 | Done — shell · engine · Thunder · AP workflow · solid unit UI |
| **6** | **Done** — AR encaissement prefill · Cut-safe CTRL+X · ⌃X/Cut toggles |
| **7** | **Done** — device pairing (AUTHORITY code → OS keyring Bearer) |

## Run

```bash
npm run dev -w authority-x   # tray + CTRL+X + summon :17898
```

AUTHORITY + API in parallel (`npm run dev`).

## Flow

```text
CTRL+X → commande → pick entity
  → Encaissement client  → /finance/payments?create=1&…
  → Paiement fournisseur → /finance/ap-bills?create=1&…
  → Drawer AUTHORITY prérempli → human Enregistrer
```

**Cut-safe ON** (défaut) : dans un champ Edit Win32, CTRL+X = Couper (X ne vole pas). Tray / boutons ⌃X · Cut.

**Device auth (D274)** : Préférences AUTHORITY → Poste → Générer un code → coller dans X. Jeton `axd_` dans le keyring OS. Intent Thunder = Bearer. **Pas** de cookie tray. **Pas** d’écriture silencieuse.

**Transfer** = Banque AUTHORITY only (`Treasury pending`) — pas de CREATE_TRANSFER inventé.

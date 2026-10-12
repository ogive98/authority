# AUTHORITY X

Desktop companion for the AUTHORITY web shell — **not** an ERP module.

## Phases

| Phase | Status |
|-------|--------|
| 2–5 | Done — shell · engine · Thunder · AP workflow · solid unit UI |
| **6** | **Done** — AR encaissement prefill · summon global non-invasif (Ctrl+Alt+X) |
| **7** | **Done** — device pairing (AUTHORITY code → OS keyring Bearer) |

## Run

```bash
npm run dev -w authority-x   # tray + Ctrl+Alt+X + summon :17898
```

AUTHORITY + API in parallel (`npm run dev`).

## Flow

```text
Ctrl+Alt+X → commande → pick entity
  → Encaissement client  → /finance/payments?create=1&…
  → Paiement fournisseur → /finance/ap-bills?create=1&…
  → Drawer AUTHORITY prérempli → human Enregistrer
```

**Input policy** — X ne vole jamais la frappe d'une autre application :

- Le summon global n'utilise **aucune** combinaison d'édition (Ctrl+X/C/V/Z/A refusés) :
  une hotkey système est consommée avant l'app ciblée, donc Couper/Coller serait mort partout.
- X réduit (orb seul) = click-through **et** `WS_EX_NOACTIVATE` : la fenêtre ne peut pas
  détenir le focus clavier, la frappe repasse immédiatement à l'ERP.
- X déployé = focusable et au premier plan, c'est le seul état qui reçoit les touches.

**Device auth (D274)** : Préférences AUTHORITY → Poste → Générer un code → coller dans X. Jeton `axd_` dans le keyring OS. Intent Thunder = Bearer. **Pas** de cookie tray. **Pas** d'écriture silencieuse.

**Transfer** = Banque AUTHORITY only (`Treasury pending`) — pas de CREATE_TRANSFER inventé.

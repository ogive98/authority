# Pack absorption — notes repo

La **vérité documentation** vit dans :

`C:\Users\admin\Downloads\AUTHORITY-DOCUMENTATION`

## Index packs

Voir `18_PACK_ABSORPTION/README.md` et `CONTRADICTIONS.md`.

## Décisions LOCKED applicables au code (2026-09-03)

1. **Host + plugins** — jamais hardcoder la liste modules dans `apps/web`
2. **Éditions** — Free / Premium / Enterprise + Forge (capabilities, pas `if (plan===…)`) — D028
3. **Tenancy** — `companyId` = OrgCompany ; `tenantId` = alias seulement — D029  
   Voir doc `TENANCY_MODEL.md` ; `createThunderContext` normalise les deux
4. **Fonts** — IBM Plex only (pas Geist/Inter)
5. **Accent** — teal D016
6. **Surface UI** — token **`lightning`** (pas Ghost) — D030
7. **Thunder** — HOW only
8. **AI** — optionnelle ; stub Disabled avant THU-08+
9. **Queues** — `critical|ops|notify|print|import|analytics`
10. **RTL/AR** — Phase 2 — D031

## Prochaine implémentation code

1. Finir THU-05 → THU-08  
2. UI registries (track UI)  
3. Entitlements engine (Pack 3)  
4. Modules métier plugins  

Ne pas exécuter les prompts Cursor des packs ZIP **tels quels**.

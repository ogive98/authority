# Pack absorption — notes repo

La **vérité documentation** vit dans :

`C:\Users\admin\Downloads\AUTHORITY-DOCUMENTATION`

## Index packs

Voir `18_PACK_ABSORPTION/README.md` et `CONTRADICTIONS.md`.

## Dernier pack — Thunder Core Cursor Pack V2 (2026-09-03)

- Verdict : **ADAPT + DEFER**
- Synthèse : `18_PACK_ABSORPTION/THUNDER_CORE_V2.md`
- Audit : `15_MEMORY/PACK_V2_AUDIT_2026-09-03.md`
- Track CAP : `17_IMPLEMENTATION/13_TRACK_CAPABILITY.md`
- Copie : `18_PACK_ABSORPTION/packs/AUTHORITY_THUNDER_CORE_CURSOR_PACK_V2/`
- **C15 LOCKED** : THU-07→08 ✅ ; pack V2 phase 3 = CAP lots
- **CAP-01 ✅** — static catalog + `GET /api/v1/capabilities` (read-only)
- **CAP-02 ✅** — `CapabilityResolver` + `CapabilityGuard` (`sales.ping`)
- **CAP-03 ✅** — lifecycle + company health
- **Next :** CAP-04 — Super Admin ENABLE/DISABLE
- CQRS / Command-Query bus : **C12 DEFER**
- AI réelle : **C06 OPEN** (stub only)

## Décisions LOCKED applicables au code

1. **Host + plugins** — jamais hardcoder la liste modules dans `apps/web`
2. **Éditions** — Free / Premium / Enterprise + Forge — D028
3. **Tenancy** — `companyId` = OrgCompany ; `tenantId` = alias — D029
4. **Fonts** — IBM Plex only
5. **Accent** — teal D016
6. **Surface UI** — **`lightning`** — D030
7. **Thunder** — HOW only
8. **AI** — optionnelle ; stub avant capability/AI réelle
9. **Queues** — `critical|ops|notify|print|import|analytics`
10. **RTL/AR** — Phase 2 — D031
11. **Pack V2** — pas d’exécution master prompt ZIP ; EXTEND only
12. **Catalog ≠ activation** — manifests descriptifs ; `ModModuleState` = vérité company
13. **CAP sequential** — CAP-01→04 un lot à la fois ; no duplicate buses/registries

## Prochaine implémentation code

1. CAP-02 capability resolve + guard  
2. CAP-03 lifecycle runtime ; CAP-04 Super Admin enable/disable  
3. Track UI registries  
4. Entitlements engine (Pack 3)  

Ne pas exécuter les prompts Cursor des packs ZIP **tels quels**.

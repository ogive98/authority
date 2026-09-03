# AUTHORITY (code)

Monorepo **SOC-01** — NestJS API + Next.js web + Docker infra.

## Constitution

Specs : `C:\Users\admin\Downloads\AUTHORITY-DOCUMENTATION`  
Implémentation : `17_IMPLEMENTATION/04_TRACK_SOCLE.md`  
Packs absorbés (règles code) : [docs/PACK_ABSORPTION.md](docs/PACK_ABSORPTION.md)

## Structure

```text
apps/
├── api/   NestJS — port 3001
└── web/   Next.js — port 3000
docker-compose.yml   postgres, redis, minio
```

## Prérequis

Node ≥ 20, PostgreSQL 16+, Redis 7 (Docker **ou** install local).

Voir [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) pour Docker + PostgreSQL déjà installé.

## Démarrage

```powershell
# Infra (postgres, redis) — Docker Desktop ouvert
docker compose up -d postgres redis

# Variables d'environnement (obligatoire, une seule fois)
Copy-Item .env.example .env

npm install
npm run stop:api -w api   # libère le port si instance précédente
npm run dev:api           # terminal 1
npm run dev:web    # terminal 2
```

## Qualité (gate SOC-01)

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Health

- `GET http://localhost:3001/health/live`
- `GET http://localhost:3001/health/ready`

## Identity (SOC-03)

- `POST http://localhost:3001/api/v1/identity/auth/login`
- `GET http://localhost:3001/api/v1/identity/me`
- `PATCH http://localhost:3001/api/v1/identity/me` (audit + outbox, même transaction)
- `DELETE http://localhost:3001/api/v1/identity/sessions/:id`

Demo (seed dev) : `demo@authority.local` / `DemoPass123!`  
Limited (seed, no `identity.self.read`) : `limited@authority.local` / `LimitedPass123!`

## Permissions (SOC-06)

Évaluation serveur uniquement. Pas de `permission: *`. SPECTRE n’ajoute aucun grant.

- `GET http://localhost:3001/api/v1/identity/permissions/catalog`
- `POST http://localhost:3001/api/v1/identity/permissions/check`

## Organization (SOC-04)

- `GET http://localhost:3001/api/v1/organization/companies`
- `PUT http://localhost:3001/api/v1/organization/me/context`
- `GET http://localhost:3001/api/v1/organization/companies/:id/sites`

Headers optionnels : `X-Authority-Company-Id`, `X-Authority-Site-Id`

## Super Admin (SOC-05)

Realm distinct du métier (cookie `authority_super_admin_session`, sessions `SUPER_ADMIN`).

- `POST http://localhost:3001/api/super-admin/v1/auth/login`
- `POST http://localhost:3001/api/super-admin/v1/auth/mfa/verify`
- `GET http://localhost:3001/api/super-admin/v1/health`

Seed (dev) : `superadmin@authority.local` / `SuperAdminPass123!`  
TOTP enforced in production; opt-in via `AUTHORITY_SUPER_ADMIN_MFA_ENFORCED=true`. Membership table `iam_super_admin_membership` — never `is_super_admin`.

## Modules + flags (SOC-07)

- `GET http://localhost:3001/api/v1/modules`
- `GET http://localhost:3001/api/v1/sales/ping` → 403 `MOD.DISABLED` (métier seed DISABLED)
- `GET http://localhost:3001/api/v1/platform/search` → 403 `MOD.FLAG_OFF` (`platform.search` seed OFF)

## Postman

Importe les fichiers du dossier `postman/` :

1. **Import** → `AUTHORITY.api.postman_collection.json`
2. **Import** → `AUTHORITY.local.postman_environment.json`
3. Sélectionne l'environnement **AUTHORITY — Local** (coin haut droit)
4. Lance **Collection Runner** sur `AUTHORITY API` (Login avant Me)

Les cookies de session métier sont gérés après **Identity → Login**. Le realm Super Admin utilise un cookie distinct (`authority_super_admin_session`) — lancer **Super Admin → Login** avant **Super Admin → Health**.

## Git

Commit + push à chaque finalisation de lot SOC/THU/UI.

## État

- [x] SOC-01 skeleton
- [x] SOC-02 database / Prisma kernel
- [x] SOC-03 identity (login, /me, sessions, lockout)
- [x] SOC-04 tenancy (company/site context, IDOR)
- [x] SOC-05 super-admin auth (distinct realm, TOTP, gate 401)
- [x] SOC-06 permission engine (grants, guard, matrix `platform.*` / `identity.*`)
- [x] SOC-07 module registry + flags (DISABLED → 403, flag OFF masque API)
- [x] SOC-08 audit + outbox (write user → aud_event + core_outbox same tx)
- [x] SOC-10 license stub (signed, Redis cache, site limits)

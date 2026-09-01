# AUTHORITY (code)

Monorepo **SOC-01** — NestJS API + Next.js web + Docker infra.

## Constitution

Specs : `C:\Users\admin\Downloads\AUTHORITY-DOCUMENTATION`  
Implémentation : `17_IMPLEMENTATION/04_TRACK_SOCLE.md`

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
- `DELETE http://localhost:3001/api/v1/identity/sessions/:id`

Demo (seed dev) : `demo@authority.local` / `DemoPass123!`

## Organization (SOC-04)

- `GET http://localhost:3001/api/v1/organization/companies`
- `PUT http://localhost:3001/api/v1/organization/me/context`
- `GET http://localhost:3001/api/v1/organization/companies/:id/sites`

Headers optionnels : `X-Authority-Company-Id`, `X-Authority-Site-Id`

## Postman

Importe les fichiers du dossier `postman/` :

1. **Import** → `AUTHORITY.api.postman_collection.json`
2. **Import** → `AUTHORITY.local.postman_environment.json`
3. Sélectionne l'environnement **AUTHORITY — Local** (coin haut droit)
4. Lance **Collection Runner** sur `AUTHORITY API` (Login avant Me)

Les cookies de session sont gérés automatiquement après **Identity → Login**.

## Git

Commit + push à chaque finalisation de lot SOC/THU/UI.

## État

- [x] SOC-01 skeleton
- [x] SOC-02 database / Prisma kernel
- [x] SOC-03 identity (login, /me, sessions, lockout)
- [x] SOC-04 tenancy (company/site context, IDOR)
- [ ] SOC-05 super-admin auth

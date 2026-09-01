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

```bash
# Infra (postgres, redis, minio)
docker compose up -d

# Dépendances (racine)
npm install

# API
npm run dev:api

# Web (autre terminal)
npm run dev:web
```

Copier `.env.example` → `.env` si besoin.

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

## Git

Commit + push à chaque finalisation de lot SOC/THU/UI.

## État

- [x] SOC-01 skeleton
- [x] SOC-02 database / Prisma kernel
- [ ] SOC-03 identity

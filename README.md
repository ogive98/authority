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

Node ≥ 20, Docker (pour l’infra locale).

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

Commit après validation. **Push seulement** avec autorisation explicite.

## État

- [x] SOC-01 skeleton
- [ ] SOC-02 database / Prisma

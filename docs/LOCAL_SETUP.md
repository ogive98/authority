# Configuration locale — Docker + PostgreSQL

Deux profils possibles. **Recommandé si PostgreSQL est déjà installé : profil B.**

## Profil A — Tout via Docker

Idéal si tu n’as **pas** de PostgreSQL local sur le port 5432.

### 1. Installer Docker Desktop (Windows)

1. Télécharger : https://docs.docker.com/desktop/setup/install/windows-install/
2. Installer, redémarrer si demandé.
3. Lancer **Docker Desktop** → attendre « Docker is running ».
4. Vérifier dans PowerShell :

```powershell
docker --version
docker compose version
```

### 2. Démarrer l’infra

```powershell
cd C:\Users\admin\Projects\Authority
docker compose up -d
docker compose ps
```

Services :

| Service  | Port | Usage SOC-01+ |
|----------|------|----------------|
| postgres | **5433** (host) → 5432 (container) | SOC-02 Prisma  |
| redis    | 6379 | SOC-02+ jobs   |
| minio    | 9000 / 9001 (console) | SOC-09 files |

### 3. Fichier `.env`

```powershell
Copy-Item .env.example .env
```

Les valeurs par défaut de `.env.example` fonctionnent avec le compose fourni.

---

## Profil B — PostgreSQL local + Docker (redis/minio)

**Recommandé** quand PostgreSQL est déjà installé sur Windows.

### 1. Conflit port 5432

Si PostgreSQL Windows écoute déjà sur 5432, **ne lance pas** le conteneur `postgres` du compose (sinon conflit de port).

Démarrer seulement redis + minio :

```powershell
cd C:\Users\admin\Projects\Authority
docker compose up -d redis minio
```

### 2. Créer la base AUTHORITY dans PostgreSQL local

Ouvrir **pgAdmin** ou `psql` (adapter utilisateur/mot de passe selon ton install) :

```sql
CREATE USER authority WITH PASSWORD 'authority' CREATEDB;
CREATE DATABASE authority OWNER authority;
GRANT ALL PRIVILEGES ON DATABASE authority TO authority;
```

Si l’utilisateur existe déjà, seulement :

```sql
CREATE DATABASE authority OWNER ton_utilisateur_existant;
```

### 3. Fichier `.env`

```powershell
Copy-Item .env.example .env
```

Adapter `DATABASE_URL` à **ton** PostgreSQL :

```env
# Exemple — remplace user/password si différent
DATABASE_URL=postgresql://authority:authority@localhost:5432/authority

# Ou avec ton superuser local :
# DATABASE_URL=postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/authority
```

Redis et MinIO restent sur les URLs par défaut si tu utilises Docker pour eux.

### 4. Vérifier la connexion PostgreSQL

```powershell
# Si psql est dans le PATH (adapter -U)
psql -U authority -d authority -h localhost -c "SELECT version();"
```

---

## Profil C — Sans Docker (PostgreSQL seul pour SOC-02)

Pour SOC-02 (Prisma), **PostgreSQL suffit**. Redis et MinIO arrivent plus tard (SOC-08 jobs, SOC-09 files).

- Configure `.env` avec ta `DATABASE_URL`.
- `/health/ready` ne pingera postgres qu’à partir de SOC-02.

---

## Commandes utiles Docker

```powershell
# État des conteneurs
docker compose ps

# Logs
docker compose logs -f postgres
docker compose logs -f redis

# Arrêter
docker compose down

# Arrêter + supprimer volumes (reset DB Docker)
docker compose down -v
```

---

## Démarrer l’application

```powershell
cd C:\Users\admin\Projects\Authority
npm install
npm run dev:api    # terminal 1 — http://localhost:3001
npm run dev:web    # terminal 2 — http://localhost:3000
```

Health :

- http://localhost:3001/health/live
- http://localhost:3001/health/ready

---

## SMTP / invitations (D129–D136)

**Siège :** Préférences → **Envois** — TTL, templates, auto-send, SMTP (`identity.invite.*` / `identity.smtp.*`).

**Fallback serveur** (si hôte société vide) :

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=AUTHORITY <noreply@example.com>
AUTHORITY_WEB_ORIGIN=http://localhost:3000
```

Après mise à jour des `set_def` (seed), redémarrer `dev:api`. Un échec SMTP **n’annule pas** l’invitation.

---

## Dev light (RAM laptop) — D115

Si Docker / Nest / Next saturent la RAM (95–100 %), **Thunder ne résout pas** le problème : les workers BullMQ sont déjà dans l’API dès que `REDIS_URL` est set.

Dans `.env` (puis **redémarrer** `dev:api` et `dev:web`) :

```env
THUNDER_WORKERS_ENABLED=false
THUNDER_EVENTS_ENABLED=false
NEXT_PUBLIC_AUTHORITY_SHELL_LIGHT=true
```

Effets :

| Flag | Effet |
|------|--------|
| `THUNDER_WORKERS_ENABLED=false` | Pas de 6 workers BullMQ in-process |
| `THUNDER_EVENTS_ENABLED=false` | Pas de consumer Redis events / timers associés |
| `NEXT_PUBLIC_AUTHORITY_SHELL_LIGHT=true` | Monitor shell toutes les **60 s** (sinon **15 s**) ; SSE notifs mock **off** ; pause poll si onglet caché |

Aussi : plafonner la RAM Docker Desktop (WSL2), tuer les `node` orphelins, un seul Postgres, MinIO off si inutile.

Mesure rapide :

```powershell
Get-Process node,com.docker.backend,vmmemWSL -ErrorAction SilentlyContinue |
  Sort-Object WorkingSet64 -Descending |
  Select-Object Name,Id,@{N='MB';E={[math]::Round($_.WorkingSet64/1MB)}}
```

---

## Dépannage

| Problème | Cause probable | Action |
|----------|----------------|--------|
| `port 5432 already in use` | PostgreSQL Windows actif | Profil B : `docker compose up -d redis minio` seulement |
| `docker: command not found` | Docker Desktop pas lancé / pas installé | Installer Docker Desktop ou Profil C |
| `password authentication failed` | `DATABASE_URL` incorrecte | Vérifier user/password dans `.env` |
| WSL2 requis (Windows) | Docker Desktop demande WSL2 | Activer WSL2 : `wsl --install` puis redémarrer |

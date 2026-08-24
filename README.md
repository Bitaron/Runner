# APIForge — Postman Clone

A powerful, self-hosted API development and testing platform — Postman-compatible, built with **Next.js 14**, **Express**, **CouchDB** and **WebSocket** real-time sync.

![Runner](apps/web/public/favicon.svg) *Runner — Test, Organize, Collaborate*

---

## ✨ Features

### User Management
- JWT auth (access + httpOnly refresh), team/owner model
- **Guest mode** — one-click `Continue as Guest` (real DB user `guest-*@guest.local` with isolated workspace)
- Registration / Login / Logout / `Forgot password?` flow

### API Management
- All HTTP methods `GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS`
- Body modes `none · raw (json/xml/html/text) · form-data · x-www-form-urlencoded · GraphQL · binary`
- Auth `none · Bearer · Basic · API-Key (header/query) · OAuth 1/2 · Hawk · AWS v4` (UI + `applyAuth` + proxy)
- `Content-Type` auto-implied (`application/json`, `text/html` …) with explicit header win (case-insensitive)
- Pre-request / Test scripts (`pm.*`, `console.log`, `pm.test`) + **Console** + **Test Results**

### Collections & Organization
- Collections → nested folders (unlimited depth, `409` on duplicate name)
- Collection-level variables / auth / scripts
- Environment + Globals with `{{var}}` interpolation + autocomplete
- Soft-delete → 30-day `TrashItem` + `POST /:id/restore`

### Import / Export & DX
- Import Postman v2.1, Export
- Code generation 12 langs (`curl`, `fetch`, `axios`, `python-requests`, `go` …)
- History (`limit 100`, persisted + `POST /api/history`), Global Search (`⌘K`), WebSocket sync (`ws://…/ws`)

---

## 🧱 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand (persist), `axios`, `lucide-react` |
| Backend | Express 4 + TypeScript, `nano` (CouchDB), `axios` proxy, `ws`, `jsonwebtoken`, `zod`, `helmet`, `rate-limit` |
| DB | CouchDB 3 (views `by_type`, `by_workspace`, Mango `deletedId`) |
| Realtime | WebSocket `syncManager` (`onEvent` add/update/delete) |
| Deploy | Docker multi-stage (`node:20-alpine`), `docker-compose` + `nginx:alpine`, `start.sh` (Podman/Docker) |

---

## ✅ Prerequisites

- **Node.js 18+** (`node -v`) and **npm 9+** (`npm -v`) — see `engines` in `package.json`
- **CouchDB** — one of: Docker/Podman, native install, or hosted (IBM Cloudant compatible)
- **Git**, `curl` (for health checks), `lsof` (used by `start.sh`)

```bash
node -v # >=18
npm -v  # >=9
docker -v || podman -v
curl -V
```

---

## 🚀 Quick Start (Development — 2 minutes)

```bash
git clone <repository-url> postman-clone
cd postman-clone

# 1) Install
npm install

# 2) Env
cp .env.example .env
# → edit .env: set JWT_SECRET, JWT_REFRESH_SECRET (openssl rand -hex 32), CORS_ORIGIN, COUCHDB_* 

# 3) CouchDB (pick ONE of the four methods below)
./start.sh -c                # ← easiest: Podman/Docker if available
# or see “CouchDB Setup” section

# 4) Run both services (CouchDB must be up)
./start.sh -l                # or: npm run start:services
#   Web  http://localhost:3000
#   API  http://localhost:4000  (GET /api/health → {"success":true})
#   Couch http://localhost:5984 (admin/password)

# alternative manual (two terminals):
# npm run dev:api   # ts-node-dev --respawn src/index.ts → PORT 4000
# npm run dev       # next dev -p 3000
```

> **E2E report:** See [`E2E_SCENARIOS.md`](./E2E_SCENARIOS.md) (141 scenarios, Playwright headless) and `USER_GUIDE.md` for usage.

---

## 🗄️ CouchDB Setup — Install & Verify (Dev & Prod)

CouchDB stores `user|team|workspace|collection|request|environment|history|trash|revoked_token` via `nano`. DB name `apiforge` auto-created on `initDatabase()` (`apps/api/src/config/database.ts:11`).

### Option A — Docker (recommended, dev)

```bash
docker run -d --name apiforge-couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=password \
  couchdb:3

# verify
curl -s http://admin:password@127.0.0.1:5984/ | jq
curl -s http://admin:password@127.0.0.1:5984/apiforge | jq  # 404 before first API start → 200 after
# or
./start.sh -c
```

### Option B — Podman (as used by `start.sh -c`)

```bash
podman run -d --name apiforge-couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password \
  couchdb:3
podman ps --format '{{.Names}}' | grep apiforge-couchdb
curl -4 -s http://localhost:5984/ | grep couchdb
```

`start.sh` auto-detects `podman` vs `docker`, checks `lsof -Pi :5984`, waits `curl -4 http://localhost:5984 30s`.

### Option C — Native (Homebrew / apt)

```bash
# macOS
brew install couchdb
brew services start couchdb
# → set admin user via Fauxton http://127.0.0.1:5984/_utils → Setup single node admin/password

# Ubuntu/Debian
sudo apt update && sudo apt install -y couchdb
sudo systemctl enable --now couchdb
curl http://admin:password@127.0.0.1:5984/_all_dbs | jq
```

Set in `.env`:
```env
COUCHDB_URL=http://admin:password@127.0.0.1:5984
COUCHDB_DATABASE=apiforge
COUCHDB_ADMIN_USER=admin
COUCHDB_ADMIN_PASSWORD=password
```

### Option D — Hosted (Cloudant / IBM)

```env
COUCHDB_URL=https://<apikey>@<host>.cloudant.com
COUCHDB_DATABASE=apiforge
```

### Verify & Inspect

```bash
# health
curl -s http://admin:password@127.0.0.1:5984/ | jq .vendor

# list DBs
curl -s http://admin:password@127.0.0.1:5984/_all_dbs | jq

# find collections (Mango)
curl -s http://admin:password@127.0.0.1:5984/apiforge/_find \
  -H 'Content-Type: application/json' \
  -d '{"selector":{"type":"collection"},"limit":5}' | jq

# verify a collection created via UI lands in CouchDB
curl -s http://admin:password@127.0.0.1:5984/apiforge/collection:<uuid> | jq '{_id,_rev,type,name,workspaceId}'

# Fauxton UI
open http://127.0.0.1:5984/_utils
```

**Troubleshooting CouchDB:**
- `curl: (7) Failed to connect` → `lsof -Pi :5984` vs `docker ps`/`podman ps`, check `COUCHDB_USER/PASSWORD` match `.env`
- `404 apiforge not found` before first API start is normal — `initDatabase()` creates it; after `npm run dev:api` it becomes `200`
- On `arm64` (M1) use `couchdb:3` (multi-arch), not `couchdb:latest` old

---

## 💻 Development Deployment (detailed)

### 1. Env file

`cp .env.example .env` → generate secrets:

```bash
openssl rand -hex 32  # → paste into JWT_SECRET
openssl rand -hex 32  # → JWT_REFRESH_SECRET
```

Required vars (`apps/api/src/index.ts`, `config/database.ts`):

```env
JWT_SECRET=…32+ hex…
JWT_REFRESH_SECRET=…32+ hex…
COUCHDB_URL=http://admin:password@127.0.0.1:5984
COUCHDB_DATABASE=apiforge
CORS_ORIGIN=http://localhost:3000          # comma-separated in prod
PORT=4000
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
```

### 2. Install + CouchDB

```bash
npm install
./start.sh -c          # CouchDB via Podman/Docker
# or docker run … couchdb:3 (see above)
```

### 3. Run

**All-in-one:**
```bash
./start.sh -l          # starts CouchDB (if needed) + api (4000) + web (3000), waits /api/health
# logs: tail -f /tmp/apiforge-*.log or docker/podman logs
# stop: Ctrl+C (trap cleanup) or pkill -f ts-node-dev; pkill -f next
```

**Manual (two terminals, faster HMR):**

Terminal A — API:
```bash
npm run dev:api
# → ts-node-dev --respawn --transpile-only src/index.ts
# → Database initialized
# → Server running on port 4000
# → Sync WebSocket server initialized
curl -s http://localhost:4000/api/health | jq  # {"success":true}
```

Terminal B — Web:
```bash
npm run dev
# → next dev -p 3000
open http://localhost:3000  # → /login → Continue as Guest or Register
```

**Useful dev scripts:**

```bash
npm test                # jest --workspaces (api 28 + web collectionsStore)
npm run test:watch
npm run lint            # next lint + eslint (warnings only)
npm run build           # build all workspaces
npm run build:shared && npm run build:api && npm run build:web
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
```

### 4. Verify dev

```bash
# API health
curl -s http://localhost:4000/api/health | jq
# Register
curl -s http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dev User","email":"dev@example.com","password":"Pass12345"}' | jq .data.user._id
# Create collection (land in CouchDB)
TOKEN=$(curl -s http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"dev@example.com","password":"Pass12345"}' | jq -r .data.accessToken)
WS=$(curl -s http://localhost:4000/api/workspaces -H "Authorization: Bearer $TOKEN" | jq -r .data[0]._id)
curl -s http://localhost:4000/api/collections -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"name\":\"DevColl\",\"workspaceId\":\"$WS\"}" | jq
curl -s http://admin:password@127.0.0.1:5984/apiforge/_find -H 'Content-Type: application/json' -d '{"selector":{"type":"collection","name":"DevColl"}}' | jq .docs[0]._id

# JSON POST Content-Type + parse (echo)
node -e "require('http').createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({headers:req.headers,body:b,parsed:JSON.parse(b)}))})}).listen(45679)"
curl -s http://localhost:4000/api/execute -H 'Content-Type: application/json' -d '{"method":"POST","url":"http://127.0.0.1:45679/","headers":[],"params":[],"body":{"mode":"raw","raw":"{\"a\":1}","rawType":"json"}}' | jq .data.contentType
# → "application/json", body parsed
```

---

## 🏭 Production Deployment

### 1. Build & Env (`production`)

On the **prod host** (VM, bare metal, or CI):

```bash
cp .env.example .env
# PROD .env — set strong secrets, real origins, couch internal DNS
cat > .env <<'EOF'
NODE_ENV=production
PORT=4000
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
COUCHDB_URL=http://couchdb:5984              # inside docker network; fallback admin/password via compose
COUCHDB_DATABASE=apiforge
COUCHDB_ADMIN_USER=admin
COUCHDB_ADMIN_PASSWORD=<strong-password>
CORS_ORIGIN=https://your-domain.com,https://api.your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws
# optional TLS (enables https.createServer)
# HTTPS_KEY_FILE=/etc/nginx/ssl/key.pem
# HTTPS_CERT_FILE=/etc/nginx/ssl/cert.pem
EOF
chmod 600 .env
```

**Note on `Issues.md:108/11` postponed:** `JWT_SECRET` fallback `your-super-secret…` and global rate-limiter `1000/15m` are dev defaults — in prod `CORS_ORIGIN` **must** be set and secrets must be `32+` hex; rate-limiter now uses `keyGenerator: ip:userId` per-user.

### 2. Docker Compose (recommended)

`docker/docker-compose.yml` runs `nginx → web:3000 + api:4000 + couchdb:5984` on `apiforge-network`, volumes `couchdb-data` + `uploads`, `restart: unless-stopped`.

```bash
# from repo root
npm install          # for shared build (or rely on Docker multi-stage)
npm run build:shared

cd docker
docker compose up -d --build   # or: podman-compose up -d --build
# legacy
# docker-compose up -d --build

# wait & verify
curl -4 -s http://localhost:5984/ | grep couchdb  # inside host
curl -s http://localhost/api/health | jq          # via nginx → api
curl -s http://localhost/ | head -n 20            # via nginx → web
docker compose ps
docker compose logs -f api web couchdb
```

**Compose env note:** `docker-compose.yml` sets for `api` `COUCHDB_URL=http://couchdb:5984` (service DNS) overriding `.env` for inter-container traffic; `web` gets `NEXT_PUBLIC_API_URL=http://api:4000` internally but `nginx` exposes `http://localhost`.

### 3. Via `start.sh` (Docker mode on prod with Podman)

```bash
./start.sh -d   # podman-compose up -d, waits http://localhost/api/health 60s
# access http://localhost  (or https if nginx ssl mounted)
# stop
podman-compose -f docker/docker-compose.yml down
# or: ./start.sh --help
```

### 4. Nginx & TLS

`docker/nginx.conf` proxies `/ → web:3000`, `/api → api:4000`, `/ws → api` (Upgrade). For prod TLS:

```bash
mkdir -p docker/ssl
# bring your certs
cp /etc/letsencrypt/.../fullchain.pem docker/ssl/cert.pem
cp /etc/letsencrypt/.../privkey.pem docker/ssl/key.pem

# compose already mounts ./ssl:/etc/nginx/ssl:ro
# optionally set HTTPS_KEY_FILE/HTTPS_CERT_FILE env for Node https.createServer (api/src/index.ts:113)

# reload
docker compose restart nginx
curl -k https://localhost/api/health | jq
```

Client `NEXT_PUBLIC_WS_URL` must be `wss://your-domain.com/ws` when TLS.

### 5. Health Checks & Logs (prod)

```bash
# all
curl -s https://your-domain.com/api/health | jq
curl -s https://your-domain.com/_next/static/chunks/webpack.js | head

# CouchDB (inside network)
docker exec apiforge-db curl -s http://admin:password@localhost:5984/_all_dbs | jq
docker volume inspect apiforge-network_couchdb-data

# logs
docker compose logs -f --tail 100 api
docker compose logs -f --tail 100 web
docker compose logs -f couchdb | grep -i error

# backup CouchDB
curl -s http://admin:password@127.0.0.1:5984/apiforge/_all_docs?include_docs=true | jq > backup-$(date +%F).json
```

### 6. Zero-downtime update

```bash
git pull
docker compose build api web
docker compose up -d --no-deps api web
docker compose exec api npm run build --workspace=@apiforge/shared  # if hot patch
```

---

## 📁 Project Structure

```
postman-clone/
├── apps/
│   ├── web/              # Next.js 14 frontend
│   │   ├── src/
│   │   │   ├── app/           # (app)/workspace, (auth)/login|register
│   │   │   ├── components/    # ui/*, layout/*, request/*, response/*, collection/*, sidebar/*
│   │   │   ├── stores/        # Zustand (collectionsStore, workspaceStore, authStore)
│   │   │   └── lib/           # api.ts (axios), persistence.ts, syncManager.ts, inheritance.ts
│   │   └── package.json
│   └── api/              # Express
│       └── src/
│           ├── routes/        # auth, workspaces, collections, requests, environments, teams, history, execute, search, importExport
│           ├── config/        # database.ts (nano, views, Mango)
│           ├── middleware/    # auth, rate-limit, helmet
│           ├── websocket/     # sync.ts (broadcastSyncEvent)
│           └── utils/         # jwt, tokenBlacklist
├── packages/shared/      # types (Collection, Folder, Request, Env, Team, ApiResponse)
├── docker/               # Dockerfile.web/api, docker-compose.yml, nginx.conf
├── E2E_SCENARIOS.md      # 141 headless scenarios (Playwright) — prod sign-off
├── USER_GUIDE.md         # end-user guide
├── .env.example
├── start.sh              # local / docker / couchdb-only launcher
└── README.md
```

---

## 🔌 API Endpoints

| Group | Method & Path | Auth | Description |
|-------|---------------|------|-------------|
| Auth | `POST /api/auth/register` | no | `{name,email,password}` → `201 + set cookie` |
|      | `POST /api/auth/login` | no | `{email,password}` → `200 + tokens` |
|      | `POST /api/auth/guest` | no | One-click guest `guest-*@guest.local` |
|      | `POST /api/auth/anonymous` | no | Ephemeral anonymous (no DB) |
|      | `POST /api/auth/refresh` | cookie | Rotate `jti` blacklist |
|      | `POST /api/auth/logout` | `optionalAuth` | `blacklistToken` + clear cookies |
|      | `GET /api/auth/me` | `auth` | Current user |
| Workspaces | `GET/POST /api/workspaces` | `auth` | Auto-create `Personal Workspace` if `[]` |
| Collections | `GET /api/collections?workspaceId` | `auth` | View `by_workspace` |
|            | `POST /api/collections` | `auth` | `{name,workspaceId}` → `201` + `broadcastSyncEvent` → CouchDB |
|            | `GET/PATCH/DELETE /api/collections/:id` | `auth` | Soft delete → `TrashItem` 30d |
|            | `POST /api/collections/:id/restore` | `auth` | Clears `deletedAt` + trash |
|            | `POST /api/collections/:id/folders` | `auth` | `409` on duplicate name |
| Requests | `POST /api/requests` | `auth` | `{workspaceId,collectionId,method,url,…}` |
| Environments | `GET/POST/PATCH/DELETE /api/environments` | `auth` |  |
| Teams | `GET/POST /api/teams` `POST /api/teams/:id/members` | `auth` | Invite by `email` existing user → `409` duplicate |
| History | `GET/POST /api/history` | `auth` |  |
| Execute | `POST /api/execute` | `optionalAuth` | Proxies via `axios`, auto `Content-Type` (`json/xml/html/text/urlencoded/graphql`), respects explicit header (fixed) |
| Search | `GET /api/search?q=…&workspaceId=&type=` | `auth` | `by_type` collections/requests |
| Import/Export | `POST /api/import/postman` `GET /api/export/postman/:id` | `auth` | Postman v2.1 |

---

## 📜 Scripts

```bash
npm install                    # all workspaces
npm run dev                    # web 3000
npm run dev:api                # api 4000 (ts-node-dev)
npm run start:services         # concurrently web+api
npm run build                  # shared → api → web
npm run build:shared
npm run test                   # jest --workspaces (api 28, web)
npm run lint                   # eslint --workspaces
npm run docker:up              # cd docker && compose up -d
npm run docker:down
npm run docker:logs

# per-workspace
npm run dev --workspace=@apiforge/web
npm run dev --workspace=@apiforge/api
```

---

## 🔐 Environment Variables

| Variable | Description | Default | Required in prod |
|----------|-------------|---------|------------------|
| `JWT_SECRET` | HS256 signing secret (`openssl rand -hex 32`) | `your-super-secret…` (dev fallback) | **Yes** |
| `JWT_REFRESH_SECRET` | Refresh secret | same fallback | **Yes** |
| `COUCHDB_URL` | `http://user:pass@host:5984` or `http://couchdb:5984` inside compose | `http://admin:password@127.0.0.1:5984` | Yes |
| `COUCHDB_DATABASE` | DB name auto-created | `apiforge` | No |
| `COUCHDB_ADMIN_USER/PASSWORD` | Couch user | `admin/password` | Yes (prod) |
| `PORT` | API port | `4000` | No |
| `NODE_ENV` | `development`/`production` | `development` | Yes `production` |
| `CORS_ORIGIN` | Comma list, e.g. `https://app.example.com` | `http://localhost:3000` in dev, `false` in prod if missing | **Yes** |
| `NEXT_PUBLIC_API_URL` | Browser → API | `http://localhost:4000` (dev) `http://api:4000` (compose) | Yes prod URL |
| `NEXT_PUBLIC_WS_URL` | Browser → WS | `ws://localhost:4000/ws` → `wss://…/ws` prod | Yes |
| `HTTPS_KEY_FILE`/`HTTPS_CERT_FILE` | Enable `https.createServer` | - | Optional |
| `WEB_URL` | For password-reset email link | `http://localhost:3000` | Prod URL |

---

## 🧪 Verification

```bash
# build & typecheck
npm run build
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
npm test

# E2E (headless)
# see E2E_SCENARIOS.md — 141 scenarios via Playwright MCP + echo 127.0.0.1:45679
```

---

## 🆘 Troubleshooting

| Symptom | Fix |
|---------|-----|
| `curl: (7) Failed to connect 5984` | `docker ps` vs `podman ps`, `lsof -Pi :5984`, check `COUCHDB_USER` |
| `401 No token provided` on `POST /api/collections` | Login first, `Authorization: Bearer <accessToken>` or `withCredentials` cookie |
| `Workspace is 0` after login | `GET /api/workspaces` → `[]` → auto `POST` creates `Personal Workspace` (check `page.tsx:132`) |
| `CORS` error | Set `CORS_ORIGIN` to your `https://domain` (comma-separated), not `*` |
| `zlib`/`brotli` decompress fail in `execute` | Check `verifySsl`, `followRedirects`, increase `timeout` |
| `Next.js ENOWORKSPACES` | Run from repo root: `npm run dev --workspace=@apiforge/web` not `cd apps/web && npm run dev` |

---

## 📄 License

MIT — see `LICENSE`

---

## 📚 Next

- **User Guide:** [`USER_GUIDE.md`](./USER_GUIDE.md) — step-by-step UI walkthrough (workspaces → teams → collections → folders → requests → env vars → scripts → history → search → sliding & buttons)
- **E2E Report:** [`E2E_SCENARIOS.md`](./E2E_SCENARIOS.md)


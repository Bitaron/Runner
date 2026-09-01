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

> **Pick one path:**
> - **A. Docker Compose (recommended)** — one command brings up `nginx → web:3000 + api:4000 + couchdb:5984` with volumes & restarts. See §7.
> - **B. Manual bare-metal / VM** — install CouchDB natively, build & run API and Web separately behind Nginx/systemd/PM2. See §3–6 + §8.
>
> Both paths require the same `.env` secrets and `CORS_ORIGIN`. `NEXT_PUBLIC_*` vars are **baked at `next build` time** — rebuild Web after changing them.

### 1. Production Prerequisites

On the **prod host** (Ubuntu 22.04/24.04, Debian 12, or any Linux VM):

```bash
node -v   # >=18, recommended 20 LTS
npm -v    # >=9
git --version
curl -V
nginx -v  # for manual path; not needed for Docker

# optional for Docker path
docker -v || podman -v
docker compose version || podman-compose --version
lsof -v   # used by start.sh health checks
```

Open firewall ports:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# do NOT expose 5984 or 4000 publicly — only via nginx/loopback
sudo ufw status
```

### 2. Environment Variables (`production`)

From repo root, create a production `.env` (never commit this):

```bash
cp .env.example .env
chmod 600 .env
# generate strong secrets
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → JWT_REFRESH_SECRET
```

Edit `.env` — **required in prod**:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=<paste 64-hex from openssl rand -hex 32>
JWT_REFRESH_SECRET=<paste different 64-hex>
COUCHDB_URL=http://admin:<strong-password>@127.0.0.1:5984
COUCHDB_DATABASE=apiforge
COUCHDB_ADMIN_USER=admin
COUCHDB_ADMIN_PASSWORD=<strong-password>
CORS_ORIGIN=https://your-domain.com,https://api.your-domain.com
# FRONTEND — browser-facing URLs (must be public, not docker DNS)
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws
# optional: direct TLS in Node (prefer TLS at nginx)
# HTTPS_KEY_FILE=/etc/nginx/ssl/key.pem
# HTTPS_CERT_FILE=/etc/nginx/ssl/cert.pem
WEB_URL=https://your-domain.com
```

> **Docker Compose override:** `docker/docker-compose.yml:47` sets `COUCHDB_URL=http://couchdb:5984` for inter-container DNS, and `web` uses `NEXT_PUBLIC_API_URL=http://api:4000` internally — nginx still exposes `https://your-domain.com`. For manual deploys, keep the `127.0.0.1` URL above.
>
> **Security notes:** In prod `CORS_ORIGIN` **must** be set (fallback blocks all — `apps/api/src/index.ts:40`), `JWT_SECRET` must be 32+ hex (dev fallback is `your-super-secret…`), rate-limit is `1000/15min` per `ip:userId` (`keyGenerator` at `apps/api/src/index.ts:70`).

### 3. CouchDB — Install & Secure (Prod)

CouchDB stores `user|team|workspace|collection|request|environment|history|trash|revoked_token`. DB `apiforge` is auto-created on `initDatabase()` (`apps/api/src/config/database.ts:11`) with views `by_type`, `by_workspace`, etc. Pick **one** method.

#### Option A — Docker (simplest, works for prod too)

```bash
docker run -d --name apiforge-couchdb \
  --restart unless-stopped \
  -p 127.0.0.1:5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=<strong-password> \
  -v couchdb-data:/opt/couchdb/data \
  couchdb:3

# verify (loopback only)
curl -s http://admin:<strong-password>@127.0.0.1:5984/ | jq .vendor
curl -s http://admin:<strong-password>@127.0.0.1:5984/_all_dbs | jq

# persist across reboots: already --restart unless-stopped + volume
docker ps --format '{{.Names}} {{.Status}}'
```

> For Docker Compose, skip this — `couchdb` service in `docker/docker-compose.yml:61` does it for you.

#### Option B — Native on Ubuntu/Debian (recommended for bare-metal)

```bash
sudo apt update && sudo apt install -y curl apt-transport-https gnupg

# Add CouchDB repo (Ubuntu 22.04/24.04)
curl https://couchdb.apache.org/repo/keys.asc | gpg --dearmor | sudo tee /usr/share/keyrings/couchdb-archive-keyring.gpg >/dev/null
source /etc/os-release
echo "deb [signed-by=/usr/share/keyrings/couchdb-archive-keyring.gpg] https://apache.jfrog.io/artifactory/couchdb-deb/ ${VERSION_CODENAME} main" \
  | sudo tee /etc/apt/sources.list.d/couchdb.list >/dev/null

sudo apt update
# choose: standalone, bind 127.0.0.1, set admin password when prompted
sudo apt install -y couchdb

# enable + bind loopback (or 0.0.0.0 behind firewall + nginx)
sudo sed -i 's/^bind_address = .*/bind_address = 127.0.0.1/' /opt/couchdb/etc/local.ini
sudo systemctl enable --now couchdb
sudo systemctl status couchdb --no-pager

# verify
curl -s http://admin:<strong-password>@127.0.0.1:5984/ | jq
curl -s http://admin:<strong-password>@127.0.0.1:5984/_all_dbs | jq
```

#### Option C — Native on macOS (dev/prod parity test)

```bash
brew install couchdb
brew services start couchdb
# set admin via Fauxton http://127.0.0.1:5984/_utils → Setup single node admin/<password>
curl -s http://admin:<strong-password>@127.0.0.1:5984/ | jq
```

#### Verify & Harden (all options)

```bash
# should return 200 with couchdb vendor, not 401 admin party
curl -s http://127.0.0.1:5984/ | jq        # 401 if auth required (good)
curl -s http://admin:<strong-password>@127.0.0.1:5984/ | jq .couchdb

# list DBs — empty before first API start, then contains 'apiforge'
curl -s http://admin:<strong-password>@127.0.0.1:5984/_all_dbs | jq

# after API has run once, query a type (Mango)
curl -s http://admin:<strong-password>@127.0.0.1:5984/apiforge/_find \
  -H 'Content-Type: application/json' \
  -d '{"selector":{"type":"collection"},"limit":1}' | jq

# check bind address is not 0.0.0.0 publicly
sudo ss -tlnp | grep 5984   # should be 127.0.0.1:5984 if not docker-published

# Fauxton UI (local only — do not expose publicly)
# open http://127.0.0.1:5984/_utils
```

**Troubleshooting CouchDB prod:**
- `curl (7) Failed to connect` → `sudo systemctl status couchdb`, `journalctl -u couchdb`, `lsof -Pi :5984`, check `COUCHDB_USER/PASSWORD` matches `.env`
- `404 apiforge` before first API start is normal — `initDatabase()` creates it; after `node dist/index.js` it becomes `200`
- `arm64` (M1/Graviton) use `couchdb:3` (multi-arch)
- Backups: see §10

### 4. Backend (API) — Build & Run in Prod

`apps/api` is Express 4 + `nano` + `ws` + `jsonwebtoken`. Build is `tsc` → `apps/api/dist/index.js`.

```bash
# from repo root
npm ci                              # clean install all workspaces
npm run build:shared                # build @apiforge/shared types first
npm run build:api                   # tsc → apps/api/dist
npx tsc -p apps/api/tsconfig.json --noEmit  # typecheck

# smoke test (foreground)
NODE_ENV=production PORT=4000 node apps/api/dist/index.js
# → Database initialized
# → Server running on port 4000
# → Sync WebSocket server initialized
curl -s http://127.0.0.1:4000/api/health | jq  # {"success":true}

# verify CouchDB doc lands
TOKEN=$(curl -s http://127.0.0.1:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Pass12345"}' | jq -r .data.accessToken)
# (or register first via /api/auth/register)
```

**Run with PM2 (recommended manual prod):**

```bash
sudo npm i -g pm2
pm2 start apps/api/dist/index.js --name apiforge-api --update-env -- \
  --env production
pm2 save
pm2 startup systemd  # follow printed command
pm2 logs apiforge-api
pm2 restart apiforge-api --update-env
```

**Run with systemd:**

```ini
# /etc/systemd/system/apiforge-api.service
[Unit]
Description=APIForge API
After=network.target couchdb.service
Requires=couchdb.service

[Service]
Type=simple
User=apiforge
WorkingDirectory=/opt/apiforge
Environment=NODE_ENV=production
EnvironmentFile=/opt/apiforge/.env
ExecStart=/usr/bin/node /opt/apiforge/apps/api/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now apiforge-api
sudo systemctl status apiforge-api --no-pager
journalctl -u apiforge-api -f
```

> **Uploads:** `POST /api/upload` writes to `apps/api/uploads` (also `docker-compose` volume `uploads` at `docker/docker-compose.yml:54`). Ensure `uploads/` is writable and persisted, or mount S3/EBs volume.

### 5. Frontend (Web) — Build & Run in Prod

`apps/web` is Next.js 14 App Router (output `standalone` at `apps/web/next.config.js:5`) + Tailwind + Zustand. `NEXT_PUBLIC_*` are **inlined at build** — rebuild after any URL change.

```bash
# from repo root — env must be set BEFORE build
cat .env | grep NEXT_PUBLIC
# NEXT_PUBLIC_API_URL=https://your-domain.com
# NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws

npm ci
npm run build:shared
npm run build:web                # next build → .next/standalone + .next/static
npx tsc -p apps/web/tsconfig.json --noEmit

# option 1: next start (simplest)
PORT=3000 NODE_ENV=production npm run start --workspace=@apiforge/web
# → http://127.0.0.1:3000
curl -s http://127.0.0.1:3000/ | head -n 20

# option 2: standalone server (smaller image, used by Dockerfile.web)
node apps/web/.next/standalone/server.js
# or: node apps/web/.next/standalone/apps/web/server.js (depending on workspace hoist)
# Dockerfile.web copies .next/standalone → /app and runs node server.js on 3000

# verify browser → API
curl -s http://127.0.0.1:3000/api/health | jq  # via nginx in prod, direct 4000 otherwise
```

**PM2:**

```bash
pm2 start npm --name apiforge-web --update-env -- run start --workspace=@apiforge/web
pm2 save
pm2 logs apiforge-web
```

**systemd:**

```ini
# /etc/systemd/system/apiforge-web.service
[Unit]
Description=APIForge Web
After=network.target apiforge-api.service

[Service]
Type=simple
User=apiforge
WorkingDirectory=/opt/apiforge
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/apiforge/.env
ExecStart=/usr/bin/npm run start --workspace=@apiforge/web
Restart=always

[Install]
WantedBy=multi-user.target
```

> **Important:** If you change `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_WS_URL`, run `npm run build:web` again and restart `apiforge-web`. The browser bundle (`apps/web/src/lib/api.ts:5`) reads `process.env.NEXT_PUBLIC_API_URL` at compile time, with fallback `http://localhost:4000`.

### 6. Reverse Proxy & TLS (Nginx — Manual Path)

`docker/nginx.conf` already proxies `/ → web:3000`, `/api → api:4000`, `/ws → api` (Upgrade). For manual installs, use this as template.

```nginx
# /etc/nginx/sites-available/apiforge
upstream web { server 127.0.0.1:3000; }
upstream api { server 127.0.0.1:4000; }

server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  client_max_body_size 50M;

  location / {
    proxy_pass http://web;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /api {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /ws {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

```bash
# Let's Encrypt (Ubuntu)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo nginx -t && sudo systemctl reload nginx

# alternative: copy existing certs for Docker path
mkdir -p docker/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/key.pem
# docker-compose mounts ./ssl:/etc/nginx/ssl:ro and api can use HTTPS_KEY_FILE/CERT_FILE

sudo systemctl enable --now nginx
curl -s https://your-domain.com/api/health | jq
```

> Client `NEXT_PUBLIC_WS_URL` **must** be `wss://your-domain.com/ws` when TLS; `ws://` will be blocked by browsers on HTTPS pages.

### 7. Option A — Docker Compose (All-in-One, Recommended)

`docker/docker-compose.yml` runs `nginx → web:3000 + api:4000 + couchdb:5984` on `apiforge-network`, volumes `couchdb-data` + `uploads`, `restart: unless-stopped`.

```bash
# from repo root
npm ci
npm run build:shared   # optional — Docker multi-stage builds anyway

cd docker
# set secrets in ../.env first (see §2), then:
docker compose up -d --build   # or: podman-compose up -d --build
# legacy: docker-compose up -d --build

# wait & verify
docker compose ps
docker compose logs -f api web couchdb
curl -4 -s http://127.0.0.1:5984/ | grep -i couchdb  # couch container
curl -s http://localhost/api/health | jq           # via nginx → api
curl -s http://localhost/ | head -n 20             # via nginx → web
```

Via `start.sh` (uses Podman on prod if available):

```bash
./start.sh -d   # podman-compose up -d, waits http://localhost/api/health 60s
# access http://localhost (or https if ssl mounted)
podman-compose -f docker/docker-compose.yml down
./start.sh --help
```

### 8. Option B — Manual Bare-Metal Without Docker

Use §3 (CouchDB native) + §4 (API via PM2/systemd) + §5 (Web) + §6 (Nginx). Full sequence on a fresh VM:

```bash
# 1) clone & deps
git clone <repository-url> /opt/apiforge && cd /opt/apiforge
npm ci

# 2) env
cp .env.example .env && chmod 600 .env
# edit .env with real secrets/URLs (see §2)
nano .env

# 3) CouchDB native (see §3 Option B)
sudo apt install -y couchdb && sudo systemctl enable --now couchdb
curl -s http://admin:<strong-password>@127.0.0.1:5984/ | jq

# 4) build
npm run build:shared && npm run build:api && npm run build:web

# 5) run
pm2 start apps/api/dist/index.js --name apiforge-api --update-env
PORT=3000 pm2 start npm --name apiforge-web -- run start --workspace=@apiforge/web
pm2 save && pm2 startup systemd

# 6) nginx + TLS (see §6)
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp docker/nginx.conf /etc/nginx/nginx.conf  # or template from §6
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com

# 7) verify
curl -s https://your-domain.com/api/health | jq
curl -s https://your-domain.com/ | head -n 20
```

### 9. Verify Production

```bash
# API health (direct & via nginx)
curl -s http://127.0.0.1:4000/api/health | jq  # {"success":true,"message":"API is running"}
curl -s https://your-domain.com/api/health | jq

# Web
curl -s https://your-domain.com/ | head -n 20
curl -s https://your-domain.com/_next/static/chunks/webpack.js | head

# CouchDB (loopback only)
curl -s http://admin:<strong-password>@127.0.0.1:5984/_all_dbs | jq
docker exec apiforge-db curl -s http://admin:password@localhost:5984/_all_dbs | jq  # docker path

# E2E: register + create collection (lands in CouchDB)
curl -s https://your-domain.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Prod User","email":"prod@example.com","password":"Pass12345"}' | jq .data.user._id
TOKEN=$(curl -s https://your-domain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"prod@example.com","password":"Pass12345"}' | jq -r .data.accessToken)
WS=$(curl -s https://your-domain.com/api/workspaces -H "Authorization: Bearer $TOKEN" | jq -r .data[0]._id)
curl -s https://your-domain.com/api/collections \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"ProdColl\",\"workspaceId\":\"$WS\"}" | jq
curl -s http://admin:<strong-password>@127.0.0.1:5984/apiforge/_find \
  -H 'Content-Type: application/json' \
  -d '{"selector":{"type":"collection","name":"ProdColl"}}' | jq .docs[0]._id

# WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://your-domain.com/ws  # 426/101 expected
```

### 10. Operations — Logs, Backups, Updates

```bash
# logs (manual PM2/systemd)
pm2 logs apiforge-api --lines 100
pm2 logs apiforge-web --lines 100
journalctl -u apiforge-api -f
journalctl -u couchdb -f

# logs (Docker)
docker compose -f docker/docker-compose.yml logs -f --tail 100 api
docker compose -f docker/docker-compose.yml logs -f --tail 100 web
docker compose -f docker/docker-compose.yml logs -f couchdb | grep -i error
docker volume inspect couchdb-data  # or: docker volume inspect apiforge-network_couchdb-data

# backups — CouchDB dump (run via cron)
curl -s http://admin:<strong-password>@127.0.0.1:5984/apiforge/_all_docs?include_docs=true \
  | jq > backup-$(date +%F).json
# restore
curl -s -X POST http://admin:<strong-password>@127.0.0.1:5984/apiforge/_bulk_docs \
  -H 'Content-Type: application/json' -d @backup-2026-01-01.json | jq

# zero-downtime update (Docker)
git pull
docker compose -f docker/docker-compose.yml build api web
docker compose -f docker/docker-compose.yml up -d --no-deps api web

# zero-downtime update (Manual)
git pull
npm ci && npm run build:shared && npm run build:api && npm run build:web
pm2 reload apiforge-api --update-env
pm2 reload apiforge-web --update-env
sudo nginx -t && sudo systemctl reload nginx
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


# Deployment

Deploying the Borobudur Aggregated Heatmap Dashboard with the **frontend on Vercel** and the
**backend + PostgreSQL on a self-managed server** (e.g. a college/university machine reached
over SSH).

Location data stays in Hyperbase — nothing about that changes here. Only admin auth lives in
PostgreSQL, and only the backend talks to either.

---

## 1. Topology and the constraint that drives everything

```
Browser
   │
   ├── https://your-app.vercel.app        Vercel — static Vite build
   │
   └── https://api.your-domain.ac.id      College server
                                             │
                                             ├── Nginx (TLS termination, on host)
                                             │      └── proxies to 127.0.0.1:3001
                                             │
                                             └── docker compose
                                                    ├── backend    :3001 → loopback
                                                    └── postgres   :5432 → loopback
                                                           │
                                                  Hyperbase (external, over REST)
```

The backend and database run as containers; only Nginx runs on the host. Both container ports
are published to **loopback only** — nothing but Nginx can reach them, and Postgres is not
reachable from outside the compose network at all.

The frontend and backend are on **different sites**. The session cookie must therefore travel
cross-site, and browsers only allow that when the cookie is `SameSite=None; Secure`. `Secure`
means HTTPS is **mandatory** — not a nice-to-have.

### Prerequisite: the backend must be publicly reachable over HTTPS

Vercel serves your frontend from the public internet, so the browser must be able to reach your
backend from the public internet too. Before going further, confirm the college server has:

- a **public IP or hostname** (not only a campus-internal address),
- inbound **443** open,
- a **DNS record** you control pointing at it,
- permission from your IT department to run a public service.

If any of those is missing, this topology cannot work. Two alternatives:

- **Cloudflare Tunnel** — gives a public HTTPS hostname with no inbound ports and no public IP.
  Usually the fastest path on a locked-down campus network.
- **Serve the frontend from the same server** — drop Vercel, let Nginx serve the built `dist/`
  alongside the API. Same origin, so `SameSite=Strict` keeps working and none of the settings in
  section 3 are needed. Simplest and most secure option if you don't specifically need Vercel.

---

## 2. Docker and the containers

The backend and PostgreSQL both run under `docker compose`. `docker-compose.yml` at the
repository root defines both services; `backend/Dockerfile` builds the API image.

### 2.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in for the group change to apply, then verify **without** sudo:

```bash
docker compose version
docker run --rm hello-world
```

If you get `permission denied while trying to connect to the Docker daemon socket`, the group
change has not taken effect in your current shell — reconnect over SSH rather than prefixing
everything with `sudo`.

### 2.2 Why this sidesteps the host PostgreSQL version entirely

The compose file pins `postgres:16-alpine`. The host distribution's PostgreSQL version is
irrelevant — nothing is installed on the host and `apt` is never involved.

This matters on **Ubuntu 20.04 (focal)**, whose only packaged PostgreSQL is 12. There
`gen_random_uuid()` lives in the `pgcrypto` extension rather than in core, so `db/schema.sql`
fails with `function gen_random_uuid() does not exist`. Running PostgreSQL 16 in a container
removes that problem rather than working around it.

Appendix A covers installing PostgreSQL directly on the host, for the case where a container is
not an option.

### 2.3 Environment file

Create `backend/.env` — see section 4.1 for the full contents. Two notes specific to compose:

- The `PGUSER` / `PGPASSWORD` / `PGDATABASE` values are read by **both** services: Postgres
  creates the role and database from them on first boot, and the backend connects with them.
  They only agree if they come from one place, so set them once here.
- Leave `PGHOST` alone. `docker-compose.yml` overrides it to `postgres` (the service name),
  because inside a container `127.0.0.1` is the container itself, not the host. Compose gives
  `environment` precedence over `env_file`, so the same file still works for local development.

Compose reads `${PGUSER}` and friends from a `.env` **at the repository root**, not from
`backend/.env`. Symlink it so the two stay in sync:

```bash
ln -sf backend/.env .env
```

### 2.4 Bring it up

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

`depends_on: condition: service_healthy` holds the backend until Postgres passes `pg_isready`,
so a cold start cannot produce the 500 described below.

### 2.5 The schema

On a **fresh volume**, Postgres applies `backend/src/db/schema.sql` automatically through
`/docker-entrypoint-initdb.d`. Nothing to run.

That hook only fires when the data directory is empty. On an **existing volume** it is skipped
silently, so apply the schema yourself:

```bash
docker compose exec -T postgres \
  psql -U borobudur -d borobudur_auth < backend/src/db/schema.sql
```

Either way, verify:

```bash
docker compose exec postgres psql -U borobudur -d borobudur_auth -c '\d admins'
```

### 2.6 Restarts and reboots

Both services carry `restart: unless-stopped`, so they return after a crash and after a host
reboot once Docker itself starts on boot:

```bash
sudo systemctl enable docker
```

Data lives in the `postgres_data` named volume and survives `docker compose down`. It does
**not** survive `docker compose down -v` — that flag deletes volumes, taking your admin accounts
with it.

---

## 3. Cross-site configuration

Skip this entire section if you serve the frontend from the same origin as the API.

The backend ships with both switches already implemented. Deployment only sets two environment
variables — no code changes are needed. Both default to same-origin behaviour, so local
development and a same-origin deployment are unaffected.

| Variable | Effect |
| --- | --- |
| `CROSS_SITE_COOKIE=true` | Session cookie becomes `SameSite=None; Secure` instead of `SameSite=Strict`. |
| `CORS_ORIGINS=https://a,https://b` | Only these origins may make credentialed requests. |

### 3.1 `CROSS_SITE_COOKIE`

A cookie with `SameSite=Strict` is never sent from a Vercel origin to your API, so login
succeeds and every subsequent request returns 401. Setting this to `true` switches the cookie to
`SameSite=None`, which browsers only honour together with `Secure` — so the flag also forces
`Secure` on, and **the API must be served over HTTPS**. Over plain HTTP the browser discards the
cookie and you are no better off.

Implemented in `cookieOptions()` (`backend/src/middleware/auth.middleware.ts`), which both the
signin and logout paths use, so the cookie is cleared with the same attributes it was set with.

### 3.2 `CORS_ORIGINS`

Left empty, the API reflects whichever `Origin` header arrives and allows credentials — fine on
localhost, but it means **any website could make authenticated requests to your API** once it is
publicly reachable.

`SameSite=Strict` was quietly mitigating that. Turning on `CROSS_SITE_COOKIE` removes the
mitigation, so this allowlist becomes the control that stops it. Set it to your deployed
frontend origin, comma-separated if there is more than one:

```bash
CORS_ORIGINS=https://your-app.vercel.app
```

Origins must match exactly — scheme and host, no trailing slash, no path.

> **Vercel preview deployments** get a fresh random hostname per commit
> (`your-app-abc123-team.vercel.app`), so they will not match a fixed allowlist and their logins
> will fail. That is the correct default — do not widen the allowlist to a wildcard to fix it.
> Either test previews against a separate backend, or accept that only the production domain
> authenticates.

### 3.3 Verifying before you deploy

```bash
# expect: Secure; SameSite=None
curl -si -X POST https://api.your-domain.ac.id/api/auth/admin/logout | grep -i set-cookie

# expect: the origin echoed back
curl -si -X OPTIONS https://api.your-domain.ac.id/api/auth/admin/signin \
  -H "Origin: https://your-app.vercel.app" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin

# expect: NO access-control-allow-origin header at all
curl -si -X OPTIONS https://api.your-domain.ac.id/api/auth/admin/signin \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

The third check is the one that matters: it proves the allowlist rejects unlisted origins rather
than silently reflecting them. `logout` is used for the cookie check because it emits the same
attributes as `signin` without needing valid credentials.
---

## 4. Backend deployment

### 4.1 Environment

Create `backend/.env` (gitignored — `chmod 600` it, since a shared machine has other users):

```bash
cd backend
cat > .env <<EOF
NODE_ENV=production
PORT=3001

# --- Hyperbase (location data) ---
REPOSITORY_DRIVER=hyperbase
HYPERBASE_BASE_URL=...
HYPERBASE_PROJECT_ID=...
HYPERBASE_LOCATION_COLLECTION_ID=...
HYPERBASE_TOKEN_ID=...
HYPERBASE_TOKEN_SECRET=...

# --- PostgreSQL (admin auth) ---
# PGHOST/PGPORT are overridden to postgres:5432 by docker-compose.yml; these
# values are what `npm run dev` uses locally against a published port.
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=borobudur
PGPASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
PGDATABASE=borobudur_auth

# --- Auth ---
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
ADMIN_REGISTRATION_SECRET=$(openssl rand -hex 16)

# --- Cross-site frontend (section 3) ---
CROSS_SITE_COOKIE=true
CORS_ORIGINS=https://your-app.vercel.app
EOF
chmod 600 .env
```

`JWT_SECRET` falls back to `"dev-jwt-secret-change-me"` when unset. Anyone who has read this
repository could then forge a valid admin session — generating it is not optional on a
publicly reachable server.

`PGPASSWORD` is generated on first write and then **fixed**: Postgres stores it in the volume
when the database is initialised. Changing it in `.env` later does not change the database, and
the backend will fail to authenticate. To rotate it, change it in both places:

```bash
docker compose exec postgres psql -U borobudur -d borobudur_auth \
  -c "ALTER ROLE borobudur PASSWORD 'new-password';"
```

### 4.2 Build and run

```bash
docker compose up -d --build
docker compose ps                    # both services "running", postgres "healthy"
curl -s localhost:3001/health        # {"status":"ok"}
```

`restart: unless-stopped` on both services covers crashes and host reboots — no systemd unit is
needed for the application itself, only `sudo systemctl enable docker`.

Redeploying after a code change:

```bash
git pull
docker compose up -d --build backend
```

The image is built in two stages, so the runtime layer carries no TypeScript compiler and no
devDependencies. One consequence worth knowing: `npm run db:init` is **not** available inside
the container, because it runs through `tsx`, a devDependency. Use the `psql` route in section
2.5 instead.

### 4.3 Nginx and TLS

```nginx
server {
    listen 443 ssl;
    server_name api.your-domain.ac.id;

    ssl_certificate     /etc/letsencrypt/live/api.your-domain.ac.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.ac.id/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.your-domain.ac.id;
    return 301 https://$host$request_uri;
}
```

```bash
sudo certbot --nginx -d api.your-domain.ac.id
sudo nginx -t && sudo systemctl reload nginx
```

Do not skip TLS. Without it the browser rejects the `Secure` cookie and authentication cannot
work at all in this topology.

### 4.4 Remove the debug route

`GET /api/debug/hyperbase` (`routes/debug.routes.ts`, mounted in `index.ts`) exists to verify
Hyperbase connectivity during development. Remove it — along with its `app.use` line — before
exposing the server publicly.

### 4.5 Register the admin

No admin exists until you create one; correct credentials fail without this step.

```bash
set -a; . .env; set +a
curl -s -X POST https://api.your-domain.ac.id/api/auth/admin/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"you@campus.ac.id\",\"password\":\"<pick-one>\",\"secret\":\"$ADMIN_REGISTRATION_SECRET\"}"
```

---

## 5. Frontend on Vercel

### 5.1 Project settings

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

### 5.2 Environment variable

Add under **Settings → Environment Variables**:

```
VITE_API_BASE_URL = https://api.your-domain.ac.id
```

Vite inlines `VITE_*` variables at **build time**, not runtime. Changing this value requires a
**redeploy** — restarting nothing will pick it up.

Set it for the Production environment at minimum. If you also set it for Preview, remember the
preview hostnames will not be in `CORS_ORIGINS` (section 3.2), so preview logins will fail.

### 5.3 Deploy

Push to the branch Vercel tracks, or `vercel --prod`. Once deployed, add the resulting domain to
`CORS_ORIGINS` on the backend and restart it:

```bash
docker compose up -d backend
```

---

## 6. Verification

Work down this list — each step isolates a different layer.

```bash
# 1. Backend is up
curl -s https://api.your-domain.ac.id/health

# 2. CORS allows the Vercel origin (expect access-control-allow-origin + -credentials)
curl -si -X OPTIONS https://api.your-domain.ac.id/api/auth/admin/signin \
  -H "Origin: https://your-app.vercel.app" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control

# 3. Cookie is issued with the cross-site attributes (expect: Secure; SameSite=None)
curl -si -X POST https://api.your-domain.ac.id/api/auth/admin/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@campus.ac.id","password":"<pw>"}' | grep -i set-cookie
```

Then in the browser: open the Vercel URL, log in, and confirm the dashboard loads data. In
DevTools → Application → Cookies, `borobudur_session` should be present with `HttpOnly`,
`Secure`, and `SameSite=None`.

---

## 7. Troubleshooting

**Login returns 500 `"Authentication service unavailable"`**
PostgreSQL is not reachable. The message names auth, not the database. Check
`docker compose ps` — the postgres service should be `running (healthy)` — then
`docker compose logs postgres`.

**Login returns 200 but every later request returns 401**
The cookie was not stored. Almost always one of: `CROSS_SITE_COOKIE` not set (so `SameSite`
is still `Strict`), the API served over HTTP instead of HTTPS (so `Secure` cookies are
rejected), or a `VITE_API_BASE_URL` that does not match `CORS_ORIGINS`.

**CORS error in the browser console**
The Vercel domain is missing from `CORS_ORIGINS`, or the backend was not restarted after the
variable changed. Preview deployments have different hostnames than production.

**Frontend calls `localhost:3001` in production**
`VITE_API_BASE_URL` was missing at build time, so the default was inlined. Set it in Vercel and
**redeploy** — this value cannot change without a rebuild.

**New routes return 404 after a deploy**
The container is running an older image. `docker compose restart` reuses the existing image —
rebuild instead: `docker compose up -d --build backend`. If a non-container process from an
earlier setup still holds the port, note that Node appears as `node-22` in `pgrep`, so
`pkill -f "dist/index.js"` does **not** match it; find the real PID with `ss -ltnp | grep :3001`.

**Admin credentials are correct but rejected**
No admin row exists yet. Register one via section 4.5.

**Schema fails with `function gen_random_uuid() does not exist`**
The cluster is PostgreSQL 12 or older, where that function is not in core. This cannot happen
with the compose setup (it pins `postgres:16-alpine`) — it means you are pointing at a host
PostgreSQL instead. See Appendix A.

**Backend logs `password authentication failed for user "borobudur"`**
`PGPASSWORD` in `backend/.env` no longer matches what Postgres stored when the volume was
initialised. Changing the file does not change the database. Rotate it with the `ALTER ROLE`
command in section 4.1, or destroy the volume with `docker compose down -v` — which also
deletes every admin account.

**Backend cannot reach the database at `127.0.0.1:5432`**
`PGHOST` reached the container instead of the compose network. Inside a container `127.0.0.1`
is that container. `docker-compose.yml` sets `PGHOST=postgres`; confirm with
`docker compose exec backend printenv PGHOST`.

---

## Appendix A — PostgreSQL on the host instead of a container

Only needed when Docker is unavailable or your administrators require a host-managed database.
The compose setup in section 2 is the supported path and avoids everything below.

### A.1 Check the available version

```bash
cat /etc/os-release | head -2
apt-cache policy postgresql 2>/dev/null || dnf info postgresql-server 2>/dev/null
```

`db/schema.sql` uses `gen_random_uuid()` as a **core** function, requiring **PostgreSQL 13 or
newer**. Ubuntu 22.04/24.04 (14/16), Debian 12 (15) and Rocky 9 (13) all qualify. Ubuntu 20.04
ships PostgreSQL 12 and needs section A.3.

### A.2 Install

**Debian / Ubuntu** (creates and starts a cluster automatically):

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

**RHEL / Rocky / Alma** (no cluster is created for you — `--initdb` is required):

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

### A.3 Ubuntu 20.04 (focal) only

**Option A — PostgreSQL 16 from PGDG:**

```bash
sudo apt install -y curl ca-certificates gnupg lsb-release
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt focal-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
apt-cache policy postgresql-16
```

Check that last command before installing — focal reached end of standard support in April 2025,
so PGDG may no longer publish builds for it. If a candidate is listed, install
`postgresql-16 postgresql-contrib-16`. Otherwise try 15, 14, then 13.

**Option B — PostgreSQL 12 with pgcrypto**, if PGDG has dropped focal. Create the role and
database first (A.4), then:

```bash
sudo -u postgres psql -d borobudur_auth -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
```

Must run as the `postgres` superuser, and extensions are **per-database**, so `-d borobudur_auth`
is required — installing into the default `postgres` database has no effect here. With pgcrypto
present, `gen_random_uuid()` resolves and `db/schema.sql` runs unchanged.

### A.4 Role, database, and access

```bash
DBPASS=$(openssl rand -base64 24)
echo "SAVE THIS: $DBPASS"

sudo -u postgres psql <<EOF
CREATE ROLE borobudur LOGIN PASSWORD '$DBPASS';
CREATE DATABASE borobudur_auth OWNER borobudur;
EOF
```

Confirm password authentication over loopback:

```bash
sudo grep -E '^(local|host)' "$(sudo -u postgres psql -tAc 'SHOW hba_file;')"
```

You want `host all all 127.0.0.1/32 scram-sha-256`. Debian and Ubuntu ship this by default.
RHEL and Rocky default to `ident`, which rejects password logins — change the `127.0.0.1/32` and
`::1/128` lines to `scram-sha-256`, then `sudo systemctl reload postgresql`.

**Leave `listen_addresses` at its default (`localhost`).**

### A.5 Apply the schema

```bash
cd backend
npm install
npm run db:init
```

### A.6 Connecting a containerised backend to a host database

If the backend still runs in a container, `PGHOST=127.0.0.1` points at the container, not the
host. Remove the `PGHOST` override from `docker-compose.yml` and add:

```yaml
    environment:
      PGHOST: host.docker.internal
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

This also requires PostgreSQL to accept connections from the Docker bridge — `listen_addresses`
must include the bridge address and `pg_hba.conf` must permit `172.17.0.0/16`. That widens the
database's exposure, which is precisely what the compose setup in section 2 avoids.

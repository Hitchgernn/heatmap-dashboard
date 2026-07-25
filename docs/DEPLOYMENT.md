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
                                             ├── Nginx (TLS termination)
                                             ├── Node backend  :3001
                                             └── PostgreSQL    :5432 (localhost only)
                                                      │
                                             Hyperbase (external, over REST)
```

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
  alongside the API. Same origin, so `SameSite=Strict` keeps working and none of the code
  changes in section 3 are needed. Simplest and most secure option if you don't specifically
  need Vercel.

---

## 2. PostgreSQL on the server

Admin auth needs PostgreSQL. With nothing listening on 5432, `POST /api/auth/admin/signin`
returns `500 "Authentication service unavailable"` — the message names auth, not the database,
so it reads like a credentials problem when it is not.

### 2.1 Check the available version

```bash
cat /etc/os-release | head -2
apt-cache policy postgresql 2>/dev/null || dnf info postgresql-server 2>/dev/null
```

`db/schema.sql` uses `gen_random_uuid()` as a **core** function, which requires **PostgreSQL 13
or newer**. Ubuntu 22.04/24.04 (14/16), Debian 12 (15) and Rocky 9 (13) all qualify and can use
the distro package directly (section 2.2).

**Ubuntu 20.04 "focal" ships PostgreSQL 12**, where `gen_random_uuid()` lives in the `pgcrypto`
extension rather than in core. Installing the distro package there fails at `npm run db:init`
with:

```
error: function gen_random_uuid() does not exist
```

Focal needs section 2.2b instead.

### 2.2 Install (PostgreSQL 13+ available)

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

Verify:

```bash
psql --version
sudo systemctl status postgresql --no-pager
```

### 2.2b Install on Ubuntu 20.04 (focal)

Two options. Prefer A; fall back to B when A is unavailable.

#### Option A — PostgreSQL 16 from the PGDG repository

```bash
sudo apt install -y curl ca-certificates gnupg lsb-release
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt focal-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
apt-cache policy postgresql-16
```

**Check that last command before installing.** Focal reached end of standard support in April
2025, so PGDG may no longer publish builds for it. If a candidate version is listed:

```bash
sudo apt install -y postgresql-16 postgresql-contrib-16
```

If it reports `Candidate: (none)`, try `postgresql-15`, `postgresql-14`, then `postgresql-13` —
any release ≥ 13 works unmodified. If none resolve, PGDG has dropped focal; use Option B.

Then continue from section 2.3. Nothing else differs.

#### Option B — PostgreSQL 12 with the pgcrypto extension

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

Create the role and database as in section 2.3, then enable the extension **before**
`npm run db:init`:

```bash
sudo -u postgres psql -d borobudur_auth -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
```

Two details that cause silent failures if missed:

- It must run as the `postgres` superuser — the `borobudur` role cannot create extensions.
- Extensions are **per-database**, not per-cluster, so `-d borobudur_auth` is required.
  Installing it into the default `postgres` database has no effect on this project.

With pgcrypto present, `gen_random_uuid()` resolves normally and `db/schema.sql` runs unchanged
— **no repository changes are needed**.

The cost is one undocumented setup step: anyone rebuilding this database on PostgreSQL 12
without the extension gets the `function gen_random_uuid() does not exist` error above, and the
comment in `db/schema.sql` ("no pgcrypto needed") no longer applies to their cluster.

### 2.3 Create the role and database

These names match the `env.database` defaults in `backend/src/config/env.ts`, so no extra
configuration is needed if you keep them.

```bash
DBPASS=$(openssl rand -base64 24)
echo "SAVE THIS: $DBPASS"

sudo -u postgres psql <<EOF
CREATE ROLE borobudur LOGIN PASSWORD '$DBPASS';
CREATE DATABASE borobudur_auth OWNER borobudur;
EOF
```

### 2.4 Confirm localhost password authentication

```bash
sudo grep -E '^(local|host)' "$(sudo -u postgres psql -tAc 'SHOW hba_file;')"
```

You want `host all all 127.0.0.1/32 scram-sha-256`. Debian and Ubuntu ship this by default —
**no edit needed**. RHEL and Rocky default to `ident`, which rejects password logins; change the
`127.0.0.1/32` and `::1/128` lines to `scram-sha-256`, then `sudo systemctl reload postgresql`.

**Leave `listen_addresses` at its default (`localhost`).** The backend runs on the same host, so
PostgreSQL should never accept connections from the network. This is the primary security
control for the database — there is no reason to weaken it.

Test the credentials:

```bash
PGPASSWORD="$DBPASS" psql -h 127.0.0.1 -U borobudur -d borobudur_auth -c '\conninfo'
```

### 2.5 Apply the schema

```bash
cd backend
npm install
npm run db:init          # idempotent: CREATE TABLE IF NOT EXISTS
PGPASSWORD="$DBPASS" psql -h 127.0.0.1 -U borobudur -d borobudur_auth -c '\d admins'
```

### 2.6 Survive reboots

```bash
sudo systemctl enable postgresql
sudo systemctl is-enabled postgresql
```

---

## 3. Code changes required for the cross-site split

Skip this entire section if you serve the frontend from the same origin as the API.

Both changes default to today's behaviour, so local development is unaffected.

### 3.1 Session cookie must be `SameSite=None; Secure`

`backend/src/middleware/auth.middleware.ts` currently hardcodes `sameSite: "strict"`, which
prevents the cookie from ever being sent from a Vercel origin.

```diff
 function cookieOptions() {
+  // Cross-site (frontend on another origin, e.g. Vercel) requires SameSite=None,
+  // which browsers only honour together with Secure — so HTTPS is mandatory there.
+  const crossSite = env.auth.crossSiteCookie;
   return {
     httpOnly: true,
-    secure: env.isProduction,
-    sameSite: "strict" as const,
+    secure: env.isProduction || crossSite,
+    sameSite: crossSite ? ("none" as const) : ("strict" as const),
     path: "/",
     maxAge: env.auth.cookieMaxAgeMs,
   };
 }
```

Add to the `auth` block in `backend/src/config/env.ts`:

```ts
crossSiteCookie: process.env.CROSS_SITE_COOKIE === "true",
```

### 3.2 CORS must use an explicit allowlist

`backend/src/index.ts` currently uses `cors({ origin: true, credentials: true })`. `origin: true`
reflects whichever `Origin` header arrives, and combined with `credentials: true` that means
**any website can make authenticated requests to your API** once it is publicly reachable.

`SameSite=Strict` was quietly mitigating this. Moving to `SameSite=None` removes that mitigation,
so the allowlist becomes load-bearing rather than optional.

```diff
-  app.use(cors({ origin: true, credentials: true }));
+  // Empty allowlist keeps the permissive local-dev behaviour; production sets
+  // CORS_ORIGINS so only the deployed frontend can make credentialed requests.
+  app.use(
+    cors({
+      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
+      credentials: true,
+    })
+  );
```

Add to `backend/src/config/env.ts`:

```ts
corsOrigins: (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean),
```

> **Vercel preview deployments** get a fresh random hostname per commit
> (`your-app-abc123-team.vercel.app`), so they will not match a fixed allowlist and their logins
> will fail. That is the correct default — do not widen the allowlist to a wildcard to fix it.
> Either test previews against a separate backend, or accept that only the production domain
> authenticates.

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
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=borobudur
PGPASSWORD=<the DBPASS from section 2.3>
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

### 4.2 Build and run

```bash
npm run build     # tsc -> dist/
npm start         # node dist/index.js
```

Keep it running with a systemd unit (`/etc/systemd/system/borobudur-api.service`):

```ini
[Unit]
Description=Borobudur Heatmap API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/heatmap-web-app/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now borobudur-api
curl -s localhost:3001/health        # {"status":"ok"}
```

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
sudo systemctl restart borobudur-api
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
`ss -ltnp | grep :5432` and `sudo systemctl status postgresql` first.

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
A stale process is still bound to the port. The Node process appears as `node-22` in `pgrep`, so
`pkill -f "dist/index.js"` does **not** match it. Find the real PID with `ss -ltnp | grep :3001`
and kill it, or use `sudo systemctl restart borobudur-api`.

**Admin credentials are correct but rejected**
No admin row exists yet. Register one via section 4.5.

**`npm run db:init` fails with `function gen_random_uuid() does not exist`**
The cluster is PostgreSQL 12 or older, where that function is not in core. Confirm with
`psql --version`, then either move to 13+ (section 2.2b, Option A) or enable pgcrypto against
the project database (Option B).

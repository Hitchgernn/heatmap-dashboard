# Deployment

Deploying the Borobudur Aggregated Heatmap Dashboard — frontend, backend, and PostgreSQL — as
containers on a single self-managed server (e.g. a college machine reached over SSH).

Location data stays in Hyperbase; nothing about that changes here. Only admin auth lives in
PostgreSQL, and only the backend talks to either.

---

## 1. Topology

```
Browser
   │
   └── https://dashboard.your-domain.ac.id     jarkom1 (10.42.28.70)
                                                  │
                                                  ├── cloudflared (TLS + public hostname)
                                                  │      └── reaches 127.0.0.1:8090
                                                  │
                                                  └── docker compose "borobudur-dashboard"
                                                         ├── frontend  :8090 → loopback
                                                         │     ├── serves the built dashboard
                                                         │     └── proxies /api → backend:3001
                                                         ├── backend   :3001 → loopback
                                                         └── postgres  :5433 → loopback
                                                                │
                                                       Hyperbase (same network, over REST)
```

**One origin for everything.** The browser loads the app and calls `/api/...` on the same
hostname; the frontend container's nginx proxies those calls to the backend over the compose
network. Consequences worth stating plainly:

- The session cookie stays `SameSite=Strict` — the strongest setting, and no `Secure`/HTTPS
  gymnastics are required for it to work.
- **CORS never applies.** Same-origin requests are not cross-origin requests.
- Only **one** port needs to be reachable from outside the host: the frontend's. The backend and
  database are not exposed beyond loopback at all.

All three published ports bind to `127.0.0.1` by default; only the frontend's is meant to be
opened up, via `FRONTEND_BIND` (see below). Cloudflare Tunnel provides the public hostname and
certificate, so no inbound port is opened and no certificate is managed on the server.

### Prerequisite

The server must be able to reach Hyperbase, which it does natively — `10.42.28.71` is on the
same subnet as `10.42.28.70`. No VPN is involved in production; the VPN exists only so a
developer laptop can join that network from outside.

Public reachability for *users* is handled by the tunnel (section 4.3), which needs no public IP
and no open inbound port.

### Deploying onto a shared server

If the host already runs other people's containers, read this before running anything.

- **Namespacing is handled.** `docker-compose.yml` sets `name: borobudur-dashboard`, so every
  container, network, and volume it creates is prefixed with that. A container called
  `borobudur_backend` or `borobudur_db` on the same host belongs to something else — most likely
  the mobile app — and nothing here touches it.
- **The dashboard is loopback-only by default.** `FRONTEND_BIND` defaults to `127.0.0.1`, so
  the tunnel can reach it but nothing on the local network can. Set `FRONTEND_BIND=0.0.0.0` to
  expose it to the LAN — reasonable for an on-campus demo, but it puts the login page in front
  of everyone on that network. Prefer the tunnel where you can.
- **Published host ports are the one shared resource.** All are overridable and none
  defaults to a commonly occupied value: `PG_PUBLISH_PORT` (default 5433, *not* 5432, which is
  usually taken by another Postgres), `BACKEND_PUBLISH_PORT` (default 3001), and
  `FRONTEND_PUBLISH_PORT` (default 8090 — the only one that needs to be reachable by the
  tunnel). Check before starting:

  ```bash
  sudo ss -ltnp | grep -E ':(3001|5433|8090)\b' || echo "all three free"
  ```

  A `0.0.0.0` binding by another container blocks a loopback binding here, so a port that looks
  free in `docker ps` may still conflict — trust `ss`, not the port column.
- **Never run pruning commands.** `docker system prune`, `docker volume prune`, and
  `docker image prune -a` operate host-wide and will destroy unrelated projects. Likewise never
  `docker compose down -v` here: `-v` deletes the volume holding your admin accounts.
- **Scope every command to this project.** Run compose from the repository directory, and prefer
  `docker compose ps` / `docker compose logs` over bare `docker ps` / `docker logs`, which show
  every container on the host.
- If your user is not yet in the `docker` group, prefix commands with `sudo` — or add yourself
  and reconnect (section 2.1).

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

## 3. Cross-origin settings — not needed here

This deployment serves the frontend and the API from **one origin**, so neither of the
cross-origin switches applies. Both default to off; leave them unset.

| Variable | Leave unset because |
| --- | --- |
| `CROSS_SITE_COOKIE` | The cookie stays `SameSite=Strict`, which is stronger. Setting it to `true` would force `SameSite=None; Secure` and weaken CSRF protection for no benefit. |
| `CORS_ORIGINS` | Same-origin requests are not cross-origin requests, so no CORS headers are consulted at all. |

They exist for a split deployment (frontend on Vercel or another host). If you ever move to
that, `git log` has the details — but the same-origin arrangement here is both simpler and more
secure, so treat moving away from it as a decision that needs a reason.

**Verify it really is same-origin** after deploying. The browser must never see a cross-origin
request:

```bash
# both must return the SAME host, and the second must not be a different port
curl -sI https://dashboard.your-domain.ac.id/          | head -1
curl -sI https://dashboard.your-domain.ac.id/api/docs  | head -1
```

In DevTools, `borobudur_session` should show `HttpOnly` and `SameSite=Strict`, and the Network
tab should show no CORS preflight (`OPTIONS`) requests before the API calls.


## 4. Deploying the stack

### 4.1 Environment

Create `backend/.env` (gitignored — `chmod 600` it, since a shared machine has other users):

```bash
cd backend
cat > .env <<EOF
# Set this ONLY once the dashboard is served over HTTPS. NODE_ENV=production
# makes the session cookie Secure, and browsers silently discard Secure cookies
# delivered over http:// — login succeeds, the cookie is dropped, and every
# request afterwards fails with "Authentication required". Leave it out while
# testing over plain HTTP (e.g. http://10.42.28.70:8090), then add it when the
# tunnel from section 4.3 is in front.
# NODE_ENV=production
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
# values are what `npm run dev` uses locally against the published port, which
# defaults to 5433 (see PG_PUBLISH_PORT in docker-compose.yml).
PGHOST=127.0.0.1
PGPORT=5433
PGUSER=borobudur
PGPASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
PGDATABASE=borobudur_auth

# --- Auth ---
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
ADMIN_REGISTRATION_SECRET=$(openssl rand -hex 16)

# Cross-origin switches are deliberately absent — this deployment is
# same-origin. See section 3.
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

### 4.3 Public HTTPS via Cloudflare Tunnel

`cloudflared` dials out to Cloudflare and receives traffic over that connection, so the server
needs no public IP, no inbound firewall rule, and no certificate of its own. Cloudflare
terminates TLS at its edge.

Create the tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels), add a public
hostname pointing at **`http://127.0.0.1:8090`**, and copy the connector token. Then run it:

```bash
sudo docker run -d --name tunnel-borobudur-dashboard \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run --token <YOUR_TOKEN>
```

**8090 is the frontend, not the backend.** The frontend container serves the dashboard *and*
proxies `/api` to the backend, so pointing the tunnel at 3001 would publish a bare API with no
dashboard and break the same-origin arrangement.

`--network host` is what lets the connector reach that loopback port. Without it the container's
own loopback is a separate namespace and the tunnel resolves nothing.

The token grants control of the tunnel — treat it like a password. Keep it out of the shell
history (`docker run` arguments are visible in `ps` while running), and out of the repository.

Verify from anywhere:

```bash
curl -s  https://dashboard.your-domain.ac.id/health   # {"status":"ok"}  (proxied to backend)
curl -sI https://dashboard.your-domain.ac.id/        | head -1   # 200 — the dashboard itself
```

> On a host that already runs tunnels, name yours distinctly. A neighbour named `tunnel-5001`
> belongs to a different service; do not reuse or repoint it.

TLS is not strictly required for authentication here — a same-origin `SameSite=Strict` cookie
works over plain HTTP — but serve it over HTTPS anyway. Admin credentials cross this connection.

Using an existing reverse proxy instead? Point it at `127.0.0.1:8090` and forward `Host`,
`X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` as usual.

### 4.4 Remove the debug route

`GET /api/debug/hyperbase` (`routes/debug.routes.ts`, mounted in `index.ts`) exists to verify
Hyperbase connectivity during development. Remove it — along with its `app.use` line — before
exposing the server publicly.

### 4.5 Register the admin

No admin exists until you create one; correct credentials fail without this step.

```bash
set -a; . .env; set +a
curl -s -X POST http://localhost:3001/api/auth/admin/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"you@campus.ac.id\",\"password\":\"<at-least-8-chars>\",\"registration_secret\":\"$ADMIN_REGISTRATION_SECRET\"}"
```

---

## 5. The frontend container

`frontend/Dockerfile` builds the Vite bundle and serves it with nginx. The same nginx proxies
`/api` to the backend, which is what makes the whole deployment same-origin. There is no
separate hosting provider and no second domain.

### 5.1 The API base URL must be empty

`VITE_API_BASE_URL` is baked in as `""` by the Dockerfile's build arg. That is deliberate and
easy to get wrong in both directions:

- **Not `/api`.** The request paths in `frontend/src/lib/api.ts` already start with `/api`
  (`buildUrl("/api/heatmap/aggregate", …)`), so a `/api` base produces `/api/api/heatmap/...`
  and every request 404s.
- **Not unset.** The code falls back to `http://localhost:3001` when the variable is absent
  (`import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"`), which would make every
  browser call its *own* machine and fail for everyone but you.

Empty means requests go to `/api/...` on whatever origin served the page — exactly what the
nginx proxy handles.

Vite inlines this at **build** time. Changing it requires `docker compose up -d --build
frontend`; restarting the container does nothing.

### 5.2 Verify the built bundle

Worth checking after a build, because the failure is silent — the app loads and then every
request fails:

```bash
docker compose exec frontend grep -c "localhost:3001" /usr/share/nginx/html/assets/*.js
```

`0` (or "no match") is correct. Any hits mean the build arg did not reach Vite.

### 5.3 nginx behaviour worth knowing

`frontend/nginx.conf` handles three things beyond the proxy:

- **SPA routing** — unknown paths fall back to `index.html`, so a refresh on any in-app view
  works rather than 404ing.
- **Cache policy** — hashed files under `/assets/` are cached for a year (`immutable`);
  `index.html` is explicitly never cached. Without that split, browsers keep requesting the
  previous build's asset filenames after a redeploy and the page fails to boot.
- **Runtime DNS** — the proxy target is resolved through Docker's embedded resolver every 10s
  rather than once at startup. Otherwise recreating the backend container gives it a new IP and
  nginx keeps proxying to the dead one, returning 502 until nginx is restarted too.


## 6. Verification

Work down the list — each step isolates a different layer, so the first failure tells you where
to look.

```bash
# 1. Containers up, postgres healthy
docker compose ps

# 2. Backend alive on the compose network
curl -s localhost:3001/health                      # {"status":"ok"}

# 3. nginx serves the dashboard
curl -sI localhost:8090/ | head -1                 # HTTP/1.1 200 OK

# 4. nginx proxies /api to the backend — the same-origin path
curl -s localhost:8090/health                      # {"status":"ok"}
curl -s localhost:8090/api/auth/admin/me           # 401 unauthenticated (correct: it reached the API)

# 5. Login sets the cookie with Strict, and the session works through the proxy
curl -s -c /tmp/c.txt -X POST localhost:8090/api/auth/admin/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@campus.ac.id","password":"<pw>"}' -i | grep -i set-cookie
curl -s -b /tmp/c.txt "localhost:8090/api/dashboard/summary?window=1h" | head -c 200

# 6. Publicly, through the tunnel
curl -sI https://dashboard.your-domain.ac.id/ | head -1
```

Step 4 is the one that proves the architecture: a `401` means nginx routed the request to the
backend and the backend answered. A `404` from nginx means the proxy block is not matching.

The cookie in step 5 should read `HttpOnly; SameSite=Strict` — and **no** `Secure` unless
`NODE_ENV=production`. If you see `SameSite=None`, `CROSS_SITE_COOKIE` is set and should not be.

Finally, in the browser: open the tunnel URL, log in, and confirm the dashboard renders data.
DevTools → Network should show **no** `OPTIONS` preflight requests — their absence is the proof
that this is genuinely same-origin.


## 7. Troubleshooting

**Login returns 500 `"Authentication service unavailable"`**
PostgreSQL is not reachable. The message names auth, not the database. Check
`docker compose ps` — the postgres service should be `running (healthy)` — then
`docker compose logs postgres`.

**Login succeeds, then everything says "Authentication required"**
The cookie was issued `Secure` but served over plain HTTP, so the browser discarded it without
warning. Caused by `NODE_ENV=production` while the site is on `http://`. Confirm with:

```bash
curl -si -X POST localhost:8090/api/auth/admin/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' | grep -i set-cookie
```

If `Secure` appears, either drop `NODE_ENV` from `backend/.env` (then
`docker compose up -d backend` — `restart` will not reload env) or put the site behind HTTPS.

Note curl **ignores** `Secure` while browsers enforce it, so a curl end-to-end test passes while
the browser fails. Reproduce cookie problems in a browser, not with curl.

**Login returns 200 but every later request returns 401**
The cookie was not stored. Almost always one of: `CROSS_SITE_COOKIE` not set (so `SameSite`
is still `Strict`), the API served over HTTP instead of HTTPS (so `Secure` cookies are
rejected), or a `VITE_API_BASE_URL` that does not match `CORS_ORIGINS`.

**CORS error in the browser console**
Something is not same-origin. Either the page was loaded directly from the backend port (3001)
instead of the frontend port, or `VITE_API_BASE_URL` was baked in as an absolute URL. In this
deployment no CORS should ever be involved.

**Every API call goes to `localhost:3001` from the user's browser**
`VITE_API_BASE_URL` was absent at build time, so `lib/api.ts` fell back to its localhost default
and baked that in. Rebuild: `docker compose up -d --build frontend`, then confirm with the grep
in section 5.2. Restarting the container cannot fix it — the value is inlined at build time.

**Dashboard loads but every request 404s**
`VITE_API_BASE_URL` was built as `/api`, producing `/api/api/...`. It must be empty (section 5.1).

**Refreshing an in-app view returns 404**
nginx is not falling back to `index.html`. Check the `try_files` line in `frontend/nginx.conf`.

**API calls return 502 after redeploying the backend**
nginx is holding a stale container IP. The shipped config re-resolves through Docker's DNS every
10s, so this should self-heal — if it persists, `docker compose restart frontend`.

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

**`docker compose up` fails with `port is already allocated` / `address already in use`**
Another container or host service holds that port. A `0.0.0.0` binding elsewhere blocks a
loopback binding here, so check with `sudo ss -ltnp | grep :<port>` rather than reading the
port column of `docker ps`. Set `PG_PUBLISH_PORT` or `BACKEND_PUBLISH_PORT` to something free —
neither affects how the backend reaches Postgres, which goes over the compose network.

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

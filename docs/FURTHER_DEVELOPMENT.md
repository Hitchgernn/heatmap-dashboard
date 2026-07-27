# Further development

Written 2026-07-27, immediately after the first working deployment on `jarkom1`
(`10.42.28.70`). Everything here is work that is known to be needed, in the order it should
happen. `docs/DEPLOYMENT.md` covers how to run the stack; this covers what is still unfinished.

---

## Current state

Deployed and verified end-to-end in a browser: three containers under the compose project
`borobudur-dashboard`, reachable at `http://10.42.28.70:8090` from the college network.

Two settings are **deliberately temporary** and only exist because the site is served over plain
HTTP:

| Setting | Why it's there | Remove when |
| --- | --- | --- |
| `COOKIE_SECURE=false` | Browsers discard `Secure` cookies over `http://`, which presents as a successful login followed by "Authentication required" on every later request. | HTTPS is in front |
| `FRONTEND_BIND=0.0.0.0` | Makes the dashboard reachable from other machines on the college LAN. | The tunnel is in front |

Together these mean **the admin session cookie currently crosses the college network in
cleartext**. Anyone who can observe that network can capture and replay it without knowing the
password. This is acceptable for a demo on a lab network; it is not acceptable for anything
longer-lived. Task 1 closes it.

---

## Task 1 — Put HTTPS in front, then harden

The single highest-value remaining task, and a prerequisite for several others.

### 1a. Stand up the tunnel

Follow `docs/DEPLOYMENT.md` §4.3. In short: create a Cloudflare tunnel whose public hostname
points at `http://127.0.0.1:8090`, then run the connector with `--network host` so it can reach
that loopback port.

Confirm before changing anything else:

```bash
curl -s  https://<your-hostname>/health   # {"status":"ok"}
curl -sI https://<your-hostname>/ | head -1
```

### 1b. Restore the secure defaults

```bash
cd ~/heatmap-dashboard
sed -i '/^COOKIE_SECURE=/d' backend/.env    # cookie goes back to Secure
sed -i '/^FRONTEND_BIND=/d' backend/.env    # dashboard off the LAN, tunnel-only
docker compose up -d backend frontend
```

`up -d`, not `restart` — environment and port bindings are both fixed at container creation, so
a restart silently keeps the old values.

Verify all three, in a **browser** rather than curl (curl ignores `Secure`, browsers enforce
it — this is what hid the problem the first time):

```bash
curl -si -X POST https://<your-hostname>/api/auth/admin/logout | grep -i set-cookie
#   want: HttpOnly; Secure; SameSite=Strict

sudo ss -ltnp | grep 8090
#   want: 127.0.0.1:8090, not 0.0.0.0
```

Then log in through the public hostname and confirm the dashboard loads data.

### 1c. Rotate the admin password

It has been travelling in cleartext on the LAN. Register a fresh admin, or change the existing
password, once HTTPS is confirmed working.

---

## Task 2 — Remove the debug route

`backend/src/index.ts:54` still mounts a route marked for removal:

```ts
app.use("/api/debug", requireAuth, debugRoutes); // TEMPORARY — remove before production
```

It is `requireAuth`-gated, so it is not publicly reachable, and it is genuinely useful while
bringing a new deployment up — it verifies Hyperbase connectivity without exposing the JWT. Keep
it until Task 1 is done and the stack is stable, then delete both the `app.use` line and the
`import` at line 15, and remove `backend/src/routes/debug.routes.ts`.

---

## Task 3 — Server-side SQL aggregation

The large one. Measured and viable; deferred because it needs to be done from the college
network rather than over VPN.

### What was established

Benchmarked against the Hyperbase instance at `10.42.28.71:15514` (1,782 records):

| | Requests | Mean | Bytes | Cells |
| --- | --- | --- | --- | --- |
| Current — paginate, aggregate in Node | 4 | 9,478 ms | 329,017 | 171 |
| SQL `GROUP BY` | 1 | **1,416 ms** | 5,709 | 171 |

**6.7× faster, 57.6× less data, and byte-identical output** — the two cell maps were compared
key by key and value by value, not merely by length.

The dialect supports everything the grid snapping needs, none of it documented: arithmetic in
`SELECT`, `CAST`, `AS` aliases, `GROUP BY` on an expression, `ROUND`, `FLOOR`, and `WHERE` on
the UUIDv7 `_id` range that encodes the time window. The working query:

```sql
SELECT CAST(latitude  / 0.0001 AS INT) AS gy,
       CAST(longitude / 0.0001 AS INT) AS gx,
       COUNT(*) AS c
FROM 'data'
GROUP BY gy, gx
```

### Two blockers, neither of them technical

1. **The endpoint is missing where the data lives.** `POST .../records/query` returns **404** on
   the instance `backend/.env` points at (`hyperbasescyla.context.my.id`). It exists only on
   `10.42.28.71:15514`, whose collection holds Yogyakarta coordinates (`-7.767, 110.410`) —
   test data, not Borobudur (`-7.608, 110.204`).
2. **Nobody has confirmed which instance holds production GPS logs going forward.** Ask the
   lecturer; that answer decides whether this work has anywhere to run.

### One unmeasured risk

Every measurement so far ran **without a time filter** over a small collection. Hyperbase
implements SQL over ScyllaDB, which is not built for ad-hoc `GROUP BY`. If the
`WHERE _id >= …` range is not pushed down to the clustering key, a wide window could become a
full scan and be *slower* than pagination despite sending less data.

Measure this before writing any code:

```sql
SELECT CAST(latitude / 0.0001 AS INT) AS gy,
       CAST(longitude / 0.0001 AS INT) AS gx, COUNT(*) AS c
FROM 'data'
WHERE _id >= '<uuidv7 bound for T-15m>'
GROUP BY gy, gx
```

Run it at 15m, 1h, 1d, 7d. If latency stays roughly flat, adopt it everywhere. If it climbs
steeply with window width, adopt it selectively — timelapse and long windows — and leave the
15m default on the existing path.

### Implementation shape

The repository pattern already isolates this. `services/` never imports a concrete repository,
only the `LocationRepository` interface, so the aggregation path can change without touching
route or service code.

The cleanest approach is a **new method rather than a new driver**: add an optional
`getAggregatedCells(query)` to the interface, implement it on `HyperbaseLocationRepository`, and
have `heatmap.routes.ts` use it when present and fall back to
`getLocations()` + `aggregateToGrid()` when not. That keeps the memory driver working untouched
and makes the SQL path a progressive enhancement rather than a fork.

**Use `ROUND()` explicitly, not `CAST(… AS INT)`.** Hyperbase's `CAST` *rounds* rather than
truncating — the opposite of most SQL engines, and undocumented. It happens to match
`Math.round` in `aggregation.service.ts`, which is why the outputs matched exactly; truncation
would have produced 165 cells instead of 171. Do not depend on undocumented behaviour that
agrees with you by luck.

### Expected gains by screen

- **Dashboard default (15m window)** — likely one page either way, so expect a modest gain from
  the smaller payload, not the full 6.7×.
- **7d / 30d windows** — multi-page today, so the full multiplier applies.
- **Timelapse** — the biggest winner. It issues one request *per frame*, up to 288 frames.

### Free win available regardless

`HYPERBASE_PAGE_SIZE` 500 → 1000 measured a **55% cut** in fetch time (12,842 ms → 5,744 ms) on
identical output, with no code change — 1000 is already the repository's clamp ceiling. Worth
doing whether or not the SQL work ever happens.

---

## Task 4 — Schema migrations

There is no migration tooling. `backend/src/db/` contains `schema.sql`, `init.ts`, `pool.ts` and
nothing else, and `schema.sql` is `CREATE TABLE IF NOT EXISTS` only.

Two consequences that compound badly:

1. The `/docker-entrypoint-initdb.d` hook only fires on an **empty** volume. On an existing one
   it is skipped silently.
2. Re-running `schema.sql` against an existing database is a **no-op** — the table exists, so
   the statement does nothing. Adding a column later would appear to succeed and change nothing.

Today `admins` is stable, so this is dormant. The moment the schema changes, adopt a real
migration tool (`node-pg-migrate` or similar) rather than applying DDL by hand and hoping it was
applied everywhere.

---

## Task 5 — Tests

There are **no test files** in either package. `backend/package.json` has a `test` script wired
to `node --test` with `tsx`, but nothing to run.

The highest-value first targets, chosen because they are pure functions with fiddly logic that
CI can verify cheaply:

- `utils/parseQuery.ts` — time-window validation, the 90-day span limit, `from < to`.
- `utils/validateLocation.ts` — coordinate and timestamp validity, Borobudur bounds filtering.
- `services/aggregation.service.ts` — grid snapping and weight normalisation. A test here would
  also pin the rounding behaviour that Task 3 depends on.
- `repositories/hyperbase-location.repository.ts` `uuidV7Bound()` — the time-window-to-`_id`
  conversion, which is easy to get subtly wrong and impossible to eyeball.

CI already runs `npm test`-adjacent checks; adding real tests makes that pipeline meaningful
rather than a typecheck with extra steps.

---

## Known rough edges

**`PORT` is coupled in four places.** `config/env.ts` reads it, but `docker-compose.yml`,
`frontend/nginx.conf` (twice) and `backend/Dockerfile` (twice) hardcode `3001`. Changing `PORT`
breaks the nginx proxy and the container healthcheck while looking like it worked. Change
`BACKEND_PUBLISH_PORT` instead — that is the host-side knob and it is safe.

**Frontend bundle is ~767 kB** (~226 kB gzipped), which trips Vite's chunk-size warning. Leaflet
and Recharts dominate. Route-level code splitting would help if load time on the campus network
ever becomes a complaint. Not currently a problem.

**`CLAUDE.md` has two stale claims** worth correcting when convenient: it says
`GET /api/hotspots` reads a precomputed `ml/output/hotspots.json` (it computes live via
`detectHotspots()` now), and it says the frontend behind Nginx should use `VITE_API_BASE_URL=/api`
(it must be **empty** — the paths in `lib/api.ts` already begin with `/api`, so `/api` produces
`/api/api/...`).

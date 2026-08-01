# Borobudur Aggregated Heatmap Dashboard

A web dashboard that visualizes visitor density at the Borobudur temple.

Raw GPS logs from a mobile app are stored in Hyperbase (a ScyllaDB-backed BaaS).
The backend reads them, cleans them, drops points outside the temple bounds,
aggregates the survivors onto a fixed grid, and serves the result as GeoJSON.
The frontend polls that GeoJSON and renders it as a Leaflet heatmap.

Only aggregated grid cells ever leave the backend — never per-visitor points and
never a `visitor_id`. The response types have no field for it, so the privacy
rule holds by construction rather than by policy.

📖 **[Full documentation and project blueprint →](https://hitchgernn.github.io/heatmap-dashboard/)**

---

## Features

- **Aggregated heatmap** — grid-based density over a selectable time window
  (`5m`, `15m`, `1h`, `today`, `3d`, `7d`, `30d`, or a custom range up to 90 days)
- **Live DBSCAN hotspot detection** — clusters the current window on request,
  with tunable `eps` and `minSamples`
- **Timelapse mode** — replays a date or range in fixed steps, with frame
  caching and prefetch
- **Dashboard summary and charts** — active visitors, total points, busiest
  area, plus Recharts bar and donut breakdowns
- **Mock data generator** — weighted, realistically clustered test data that
  flows through the exact same pipeline as production data
- **Admin auth** — bcrypt + JWT in an `httpOnly`, `SameSite=Strict` cookie
- **Light / dark / system themes** and **English / Indonesian** i18n

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS v4, Leaflet + `leaflet.heat`, Recharts |
| Backend | Node.js, Express 4, TypeScript, Swagger (OpenAPI 3.0.3) |
| Location data | Hyperbase (BaaS over ScyllaDB) |
| Auth | PostgreSQL, `bcryptjs`, `jsonwebtoken` |
| ML | DBSCAN, implemented in the backend in TypeScript |
| Deployment | Docker Compose, nginx, Cloudflare Tunnel |

No map token is required — tiles are standard OpenStreetMap, with Esri World
Imagery satellite available as an opt-in layer.

## Quick start

The in-memory repository driver seeds ~97 sample points on boot, so the whole
stack runs without Hyperbase credentials.

**Backend** (from `backend/`):

```bash
npm install
npm run dev        # http://localhost:3001
```

**Frontend** (from `frontend/`):

```bash
npm install
npm run dev        # http://localhost:5173
```

Admin auth needs PostgreSQL on 5432. The intended path is
`docker compose up -d postgres`, then `npm run db:init` from `backend/`, then
register an admin via `POST /api/auth/admin/signup` using the
`ADMIN_REGISTRATION_SECRET` from `backend/.env`.

> [!NOTE]
> With nothing listening on 5432, every sign-in returns
> `500 "Authentication service unavailable"` — the message names auth, not the
> database, so it reads like a credentials problem when it is not.

API docs are served by the running backend at
[`/api/docs`](http://localhost:3001/api/docs) (Swagger UI).

## Commands

| Package | Command | Does |
|---|---|---|
| `backend/` | `npm run dev` | ts-node-dev with hot reload |
| `backend/` | `npm run build` | `tsc` → `dist/` |
| `backend/` | `npm run typecheck` | `tsc --noEmit` |
| `backend/` | `npm run db:init` | Applies `db/schema.sql` idempotently |
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | `tsc --noEmit && vite build` |
| `frontend/` | `npm run preview` | Serves the built bundle |

There is no lint step in either package. Verify changes with `npm run build`.

## Documentation

Everything is published at
**<https://hitchgernn.github.io/heatmap-dashboard/>**, built from `docs/` with
MkDocs Material.

| Document | Contents |
|---|---|
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | Project blueprint — background, scope, design, testing, status |
| [`docs/API.md`](docs/API.md) | Authoritative endpoint contract |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architecture summary |
| [`docs/HYPERBASE_SCHEMA.md`](docs/HYPERBASE_SCHEMA.md) | Authoritative Hyperbase data model |
| [`docs/DATA_FLOWS.md`](docs/DATA_FLOWS.md) | Mock generator and auth sequence diagrams |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker Compose topology and procedures |
| [`docs/FURTHER_DEVELOPMENT.md`](docs/FURTHER_DEVELOPMENT.md) | Post-deployment work |

To build the docs site locally:

```bash
pip install -r requirements-docs.txt
mkdocs serve        # http://127.0.0.1:8000
```

## Repository layout

```
backend/     Express + TypeScript API (routes → services → repositories)
frontend/    React + Vite dashboard
ml/          DBSCAN parameter-exploration notebook (not a runtime dependency)
docs/        Documentation source, published with MkDocs
scripts/     Diagram rendering helper
```

## License

Academic project. No license granted for reuse.

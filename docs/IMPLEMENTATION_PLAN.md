# Implementation Plan — 4 workstreams

> **Status: all four shipped.** WS1 Swagger `e9de215` · WS2 Timelapse animation
> `9965f76` · WS3 Mock→Hyperbase collection `450f6c8` · WS4 Auth→PostgreSQL
> `f921229`. All build-verified; WS4 also tested end-to-end against a live
> Postgres. Pending your infra to run: bring up Postgres + `npm run db:init` +
> re-register admin (WS4); provision + set `HYPERBASE_MOCK_COLLECTION_ID` (WS3).

## Context

Lecturer requirements + user asks for the Borobudur heatmap dashboard:
1. **API docs via Swagger** — the backend has no OpenAPI/Swagger today.
2. **Split auth off Hyperbase onto SQL (PostgreSQL)** — location logs stay in Hyperbase; only admin auth moves to a self-hosted Postgres DB.
3. **Mock generator → separate Hyperbase collection** — so generated data lands in a Hyperbase collection distinct from the mobile app's, and the dashboard can read it back to observe DBSCAN clustering.
4. **Timelapse "processing" animation** — a visible aggregating/loading animation so the user knows data is being fetched/processed during timelapse.

Decisions (confirmed): PostgreSQL for auth · mock write **and** dashboard reads it · swagger-jsdoc inline · all four phased in one plan.

Build order (independent; low-risk first, security-sensitive last):
**WS1 Swagger → WS2 Timelapse animation → WS3 Mock Hyperbase collection → WS4 Auth→Postgres.**

---

## WS1 — Swagger / OpenAPI docs (backend, additive, zero behavior change)

Deps: `swagger-ui-express`, `swagger-jsdoc` (+ `@types/*` dev).

- New `backend/src/config/swagger.ts` — build the OpenAPI spec with `swagger-jsdoc`: `openapi: 3.0.3`, info/title, servers (`http://localhost:3001` + `/api` behind Nginx), a `cookieAuth` security scheme (apiKey, cookie `borobudur_session`), and reusable component schemas mirroring `types/location.ts` / `API.md` (HeatmapFeatureCollection, DashboardSummary envelope, Hotspots envelope, error envelope). `apis:` globs the route files for JSDoc.
- Mount in `backend/src/index.ts`: `app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec))` and `GET /api/docs.json` returning the raw spec. Mount **before** `requireAuth`-gated routers so docs are public (dev) — or gate later if needed.
- Annotate each route with `@openapi` JSDoc blocks: `routes/heatmap.routes.ts`, `routes/dashboard.routes.ts`, `routes/mock.routes.ts`, `routes/hotspot.routes.ts`, `routes/auth/admin.routes.ts`. Reuse the enums already in `utils/parseQuery.ts` (`VALID_WINDOWS`, `VALID_SOURCES`) as `enum:` values so docs match validation.
- Source of truth for content: `docs/API.md` (authoritative contract).

Verify: `npm run build` in backend; `npm run dev`; open `http://localhost:3001/api/docs`; "Try it out" on `/api/heatmap/aggregate`.

## WS2 — Timelapse processing animation (frontend only)

Anchor points found: `hooks/useTimelapse.ts` exposes a single `loading` boolean for the current frame; surfaced as plain gray text in `components/TimelapseBar.tsx:75-83`. A not-yet-loaded frame renders as empty `points: []`.

- Extend `useTimelapse.ts` to also expose lightweight **prefetch progress**: derive `readyCount` / `totalFrames` from the promise cache (`cacheRef`) — count settled frames — so the UI can show "N of M frames ready". Keep it cheap; no new fetches.
- Add an animated indicator (reuse existing patterns, respect `prefers-reduced-motion` guard at `index.css:161-168`):
  - In `TimelapseBar.tsx`: replace the static loading `<p>` with an `animate-pulse` dot + label (mirror `LoadingState`/`StatusPill` from `TopHeader.tsx`), showing `t("tl.processing")` while `loading`.
  - In `HeatmapView.tsx`: add a subtle map overlay gated on `tl.loading` (e.g. a top-center pill or a thin shimmer bar) so the "processing" state is visible over the map, not just in the bar.
- New i18n keys in `lib/i18n.ts` (EN + ID), following existing `tl.*` keys: `tl.processing` ("Aggregating…" / "Mengagregasi…"), optional `tl.framesReady`.
- Optional: a new `@keyframes shimmer` in `index.css` (none exists today) or reuse `animate-pulse`.

Verify: `npm run build` (frontend); `npm run dev`; start a timelapse, confirm the animation shows while frames load and clears when ready.

## WS3 — Mock generator writes to a separate Hyperbase collection (backend)

Blockers today: `rejectOnHyperbase()` 400s on hyperbase driver (`mock.routes.ts:34-43`); `HyperbaseLocationRepository.insertLocation/insertManyLocations` throw `INSERT_UNSUPPORTED` (`hyperbase-location.repository.ts:142-148`); single repo singleton (`repositories/index.ts:15-31`); `getLocations` short-circuits `source==="mock"→[]` and `mapRecord` hardcodes `source:"mobile_app"`; no mock-collection env.

Approach — a **second, write-capable Hyperbase repository bound to a mock collection**, following the existing `env.hyperbaseAuth` override/fallback precedent:
- `config/env.ts`: add `env.hyperbaseMock` block — `HYPERBASE_MOCK_COLLECTION_ID` (required to enable), plus `HYPERBASE_MOCK_PROJECT_ID` / `HYPERBASE_MOCK_TOKEN_ID` / `HYPERBASE_MOCK_TOKEN_SECRET` / `HYPERBASE_MOCK_BASE_URL` each falling back to the location values. Add `mockCollectionEnabled` = boolean(collection id present).
- `repositories/hyperbase-location.repository.ts`: implement the real insert path (POST `/api/rest/project/{projectId}/collection/{collectionId}/record`, and bounded-concurrency batch for `insertManyLocations`) **behind a `writable` flag** so the mobile-app instance stays read-only (still throws) while the mock instance can write. Map `LocationLog` → Hyperbase record fields (`client_id` ← visitor_id, `latitude`, `longitude`; let Hyperbase set `_id`/`_updated_at`). Parameterize `mapRecord`'s `source` and drop the `source==="mock"` short-circuit for the mock instance.
- `repositories/index.ts`: add `getMockLocationRepository()` returning a cached write-capable Hyperbase repo bound to the mock collection (only when `mockCollectionEnabled`).
- `routes/mock.routes.ts`: change `rejectOnHyperbase` → allow when a mock collection is configured; route mock inserts through `getMockLocationRepository()`.
- Dashboard read-back: add a way to point heatmap/dashboard/hotspots reads at the mock collection — a `source`/target switch (e.g. `source=mock` on the hyperbase driver reads the mock collection via the mock repo instead of returning `[]`). Keeps privacy/aggregation pipeline unchanged.

Caveat to document: Hyperbase sets `_id` (UUIDv7) and `_updated_at` at insert time → mock rows are timestamped "now", not backdated. Fine for spatial DBSCAN observation within the current window; note it in `HYPERBASE_SCHEMA.md`.

Verify: set `HYPERBASE_MOCK_COLLECTION_ID`; `POST /api/mock/generate`; query heatmap/hotspots with the mock target; confirm clusters appear; check the DBSCAN notebook can read the collection.

## WS4 — Auth → PostgreSQL (backend; HTTP contract unchanged → no frontend changes)

Current auth is 100% Hyperbase proxy: no in-app hashing, no in-app JWT signing. Moving to Postgres means we own hashing + tokens.

Deps: `pg`, `bcryptjs` (pure-JS, portable), `jsonwebtoken` (+ `@types/*`).

- **DB**: new `admins` table (`id` uuid PK default gen_random_uuid(), `email` citext/unique, `password_hash` text, `role` text default 'admin', `created_at`). Add a Postgres service to `docker-compose.yml`. A small `backend/src/db/pool.ts` (pg Pool from `DATABASE_URL`) and a `backend/src/db/schema.sql` / init migration (run on boot or via a `npm run db:init` script).
- `config/env.ts`: add `env.database` (`DATABASE_URL` or discrete host/port/user/pass/name) and `env.jwt` (`JWT_SECRET`, `JWT_EXPIRES_IN`). Remove reliance on `env.hyperbaseAuth`/`auth.adminCollectionId` for auth (keep vars for now, mark deprecated).
- **Rewrite `services/auth.service.ts`** to a Postgres-backed implementation, keeping the SAME exported surface (`signinAdmin`, `signupAdmin`, `validateSession`, `AuthError`, `AdminUser`) so routes/middleware don't change shape:
  - `signupAdmin`: bcrypt-hash password, INSERT, return `{_id,email,role}`.
  - `signinAdmin`: SELECT by email, bcrypt.compare, sign our own JWT (`jsonwebtoken`) with `{ sub: id, email, role }`; return the JWT string (cookie handling in the route stays identical).
  - `validateSession`: `jwt.verify` with `JWT_SECRET`, load the admin row, enforce `role==="admin"`, return `{ user, token }` (re-issue/rotate if near expiry to preserve the existing cookie-rotation behavior in `auth.middleware.ts`).
  - Replace `decodeJwtPayload` (unverified) with real `jwt.verify`.
- `middleware/auth.middleware.ts`: unchanged in shape (still reads cookie, calls `validateSession`, rotates cookie). `AdminUser` `_id` stays a string (now the Postgres uuid).
- **Migration note**: Argon2id hashes in Hyperbase can't be extracted → existing admin(s) re-register via `POST /signup` (gated by `ADMIN_REGISTRATION_SECRET`). Acceptable for admin-only.
- Docs: update `docs/HYPERBASE_AUTH_INTEGRATION.md` (now Postgres) + `CLAUDE.md` Authentication section + `.env` examples.

Verify: bring up Postgres; `npm run db:init`; `POST /api/auth/admin/signup` (with secret) → `POST /signin` → cookie set → `GET /me` returns profile → a data route succeeds with the cookie; frontend login page still works unchanged.

---

## Cross-cutting

- Update `backend/.env` examples + `CLAUDE.md` per workstream. Keep Conventional Commits (`feat(backend):`, `feat(frontend):`, `docs(repo):`), one commit per workstream.
- Run `graphify update .` after each workstream so the graph stays current.
- No test runner is wired up; verification is `npm run build`/`typecheck` + manual curl/UI checks.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: Borobudur site managers.** Staff responsible for monitoring how
visitors are distributed across the temple grounds and for directing visitor
flow when a zone gets too dense. Their job on this screen is *read the current
distribution, decide whether to act, act.* They are not analysts; they are
operators reading a live picture between other duties.

The design serves the operational job first. A graded academic walkthrough
(lecturer / examiners) is a real secondary audience — this is a coursework
deliverable — but where the two conflict, the operational job wins.

Admin sign-in gates the entire dashboard; there is no public or visitor-facing
view. Every user is an authenticated admin.

## Product Purpose

Turn raw GPS logs from an existing Borobudur mobile app into a density picture a
site manager can read directly.

The raw data already exists in Hyperbase (a ScyllaDB-backed BaaS): `latitude`,
`longitude`, `client_id`, and a recording time. It cannot be read as
information. The backend fetches it, drops invalid and out-of-bounds
coordinates, aggregates the survivors onto a fixed grid, and serves that
aggregate as GeoJSON; the dashboard polls it and draws a Leaflet heat layer.

Success = a manager opens the dashboard and, without interpretation work, knows
which zones are crowded right now and how that compares to the recent past.

## Positioning

Three things a neighboring dashboard could not truthfully copy:

1. **Privacy holds by construction, not by policy.** Only grid cells carrying
   counts leave the backend. The response types have no `visitor_id` field and
   carry no per-person time ordering, so no individual movement trace can be
   reconstructed from any API response — including the DBSCAN scatter points,
   which are capped and carry position plus tier only.
2. **Aggregation is the product, not an optimization.** Streaming raw points
   would be heavy *and* would answer the wrong question. The grid is the answer.
3. **Live DBSCAN over the current window**, running in the backend in
   TypeScript with operator-tunable `eps` / `minSamples` — not a precomputed
   batch job.

## Operating Context

Site managers view this on:

- **Desk laptop / desktop browser** — the confirmed primary scene, seated and
  interactive. The current layout (collapsible sidebar, capped map column,
  charts beside it) assumes this.
- **Tablet, on the grounds** — staff walking the site. Touch targets, outdoor
  sunlight, and portrait orientation are real conditions, not hypotheticals.
- **Wall / control-room display** — viewed from a distance, largely unattended.
  Demands larger type, fewer controls, and ambient behavior.

Only the desktop scene is currently designed for. Tablet and wall-display
support are confirmed needs, not confirmed implementations — future work must
treat them as in scope rather than as speculation.

Rhythm of use: the dashboard polls heatmap + summary every 30s. Time window is
operator-chosen (`5m`, `15m`, `1h`, `today`, `3d`, `7d`, `30d`, or a custom
range up to 90 days). Timelapse mode replays a chosen date or range in fixed
steps for after-the-fact review.

Deployment: running on the campus server `jarkom1`, behind nginx, reachable on
the LAN.

## Capabilities and Constraints

Confirmed and shipped:

- Aggregated grid heatmap over a selectable time window (GeoJSON, no envelope).
- Live DBSCAN hotspot detection with tunable `eps` (2–200, default 8) and
  `minSamples` (2–50, default 5), reduced to aggregate clusters — centroid,
  count, extent radius, nearest named area, tier, share.
- Timelapse replay with frame caching and prefetch.
- Dashboard summary + Recharts bar and donut breakdowns, fed from the
  already-fetched hotspots (no extra request).
- Mock data generator flowing through the identical pipeline as real data, and
  a global Mobile App / Mock source toggle.
- Admin auth: bcrypt + JWT in an httpOnly, SameSite=Strict cookie.
- Light / dark / system themes; English / Indonesian.

Technical constraints future work must respect:

- **Serve aggregated data only.** No raw point streaming, no individual routes
  or movement history. Updates are REST polling, not WebSockets.
- **Never expose `visitor_id`** in any frontend-facing response. It exists
  internally for distinct counting; the response types have no field for it and
  must not gain one.
- **Frontend never touches Hyperbase** — everything flows through the backend
  REST API.
- GeoJSON is `[longitude, latitude]`; Leaflet is `[latitude, longitude]`.
  Convert at the boundary, never reorder the GeoJSON.
- React + Vite + TypeScript + Tailwind + Leaflet. **Not Next.js** — this is a
  client-side geospatial dashboard with no SSR or SEO need.
- No map token: standard OpenStreetMap tiles, with Esri World Imagery satellite
  as an opt-in layer. The basemap is deliberately theme-independent so the
  dashboard and the DBSCAN exploration notebook show the same place.
- Geography is centralized in `backend/src/config/bounds.ts` and
  `config/areas.ts` — never hardcode coordinates or area names elsewhere.

Terminology: *grid cell*, *weight* (0–1 normalized), *density label*, *hotspot*
(a DBSCAN cluster), *tier* (High / Medium / Low), *named area* (from
`config/areas.ts`), *time window*, *source* (`mobile_app` | `mock` | `all`).

Open / undecided:

- **ML scope.** Today it is DBSCAN hotspot detection only — no prediction,
  trajectory analysis, or route recommendation (a standing rule in CLAUDE.md).
  The user did not mark this as untouchable for future work, so treat it as the
  current scope rather than a permanent boundary; confirm before expanding it.
- Tablet and wall-display layouts are unbuilt (see Operating Context).

## Brand Commitments

Binding, confirmed by the user:

- **The three-font system**, each with one role: **Instrument Serif**
  (`font-display`) for the wordmark, page and panel headings, and prominent
  named values; **DM Sans** for anything read as a sentence (the document
  default — most elements need no font class); **Fira Code** (`font-mono`) for
  all numbers, metrics, IDs, status-pill text, and small uppercase eyebrow
  labels.
- **The stupa mark** (favicon / wordmark device).
- **English + Indonesian parity.** Every UI string ships in both. Section and
  product names stay English in both locales — Dashboard, Heatmap, Hotspots,
  Borobudur, Settings, Mock Generator read as proper nouns and sound wrong
  localized, so they live as literals in components, not in the dictionary.

## Evidence on Hand

Real, in-repo:

- Live deployment on the campus server `jarkom1`.
- `docs/BLUEPRINT.md` — the graded deliverable. Its formal tone and 17-chapter
  structure are load-bearing; do not restructure it.
- `docs/API.md` — authoritative endpoint contract.
- `docs/HYPERBASE_SCHEMA.md` — authoritative data model for the `coordinate
  data` collection.
- `ml/notebooks/dbscan_exploration.ipynb` — DBSCAN + folium parameter
  exploration, committed with outputs. Where the `eps` / `minSamples` defaults
  came from.
- Published docs site: <https://hitchgernn.github.io/heatmap-dashboard/>.
- Swagger UI at `GET /api/docs` on the running backend.

Absent — must not be fabricated: there are no real visitor counts, no usage
metrics, no testimonials, no site-manager quotes, no adoption or accuracy
numbers, no pricing, no license (academic project, no reuse granted). Sample
data in a running instance is either the ~97 seeded memory-driver points or
generated mock data.

## Product Principles

1. **Aggregate, never trace.** Every design and data decision preserves the
   property that no individual's movement can be reconstructed. This is the
   product's spine, not a compliance checkbox.
2. **The operator's glance beats the analyst's session.** A site manager should
   read the current state without study. Depth is available; it is never the
   entry cost.
3. **One place, shown consistently.** The basemap, the named areas, and the
   tier colors agree across map, charts, table, and the exploration notebook.
   The same crowd looks like the same crowd everywhere.
4. **Honest about the window.** Data is always *as of* a chosen time window and
   a chosen source. The interface must never let a stale or empty frame read as
   a calm site.
5. **Bounded scope, finished edges.** Fewer capabilities, each completed —
   empty states, both languages, both themes, real error copy.

## Accessibility & Inclusion

- Bilingual by requirement (English / Indonesian), enforced by types.
- Light / dark / system themes, persisted; an inline script applies theme and
  language before React mounts to avoid a flash.
- Density and tier meaning must not rest on hue alone — outdoor tablet use and
  distant wall viewing both degrade color discrimination.
- Tablet use implies touch-sized targets and sunlight-legible contrast; wall
  use implies distance-legible type. Neither is implemented yet.

No formal conformance standard (WCAG level) has been established for this
project.

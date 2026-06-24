---
name: commit-message
description: Generate one polished Conventional Commit message for the Borobudur Aggregated Heatmap Dashboard by inspecting staged (or unstaged) changes. Use when the user asks for a commit message.
---

# Commit Message Generator

Generate exactly one Conventional Commit message for this project based on the actual changed files.

## Procedure

1. Inspect what changed before writing anything:
   - Run `git status` to see staged vs unstaged files.
   - If staged changes exist, base the message on them (`git diff --cached --stat`, and `git diff --cached` for detail when needed).
   - If nothing is staged, base it on unstaged changes (`git diff --stat`, `git diff`).
2. Determine the single best `type` and `scope` from the changes.
3. Produce one commit message in the format below.
4. Return only the commit message in a fenced ```txt block — no preamble, no explanation — unless the user explicitly asks for reasoning.

## Format

```txt
type(scope): short summary

- area: detail
- area: detail
- area: detail
```

- Title line: `type(scope): summary` — lowercase, short, clear.
- Exactly one blank line after the title.
- Bullets describe meaningful changes, grouped by feature area.

## Allowed types

- `feat` — new features
- `fix` — bug fixes
- `refactor` — restructuring without behavior change
- `docs` — documentation
- `chore` — tooling, config, dependencies, setup
- `test` — tests
- `style` — formatting or UI-only polish
- `perf` — performance improvements

## Allowed scopes

`backend`, `frontend`, `ml`, `docs`, `docker`, `api`, `map`, `mock`, `hotspot`, `repo`

If many areas changed, use the broadest accurate scope (`repo`, `backend`, or `frontend`).

## Rules

1. Use Conventional Commit format: `type(scope): summary`.
2. Never write `type:(scope): summary`.
3. Keep the title short, clear, and lowercase.
4. Blank line after the title.
5. Add bullets for meaningful changes only.
6. Group bullet details by feature area when possible.
7. Call out important API, validation, privacy, architecture, or deployment changes.
8. No emojis.
9. No markdown headings inside the message.
10. Do not over-explain trivial edits.
11. Prefer staged changes; fall back to unstaged if nothing is staged.
12. Return only the commit message unless explanation is explicitly requested.

## Project context

Borobudur Aggregated Heatmap Dashboard.

Stack:
- frontend: React + Vite + TypeScript + Tailwind CSS + Mapbox GL JS
- backend: Node.js + Express + TypeScript
- ml: Python + Pandas + Scikit-learn + DBSCAN
- deployment: Docker Compose + Nginx on a campus server

Hard rules worth noting in summaries when relevant:
- frontend must not access Hyperbase directly
- backend handles Hyperbase access, aggregation, and GeoJSON transformation
- never expose `visitor_id` in frontend-facing responses
- heatmap uses aggregated GeoJSON, not raw GPS streaming
- ML scope is hotspot detection only, using DBSCAN

## Examples

```txt
feat(backend): complete aggregated heatmap API foundation

- heatmap: add aggregated GeoJSON endpoint with grid-based density calculation
- dashboard: add summary endpoint for active visitors, total points, crowded area, and last update
- mock: add single and bulk mock location generation endpoints
- hotspot: add file-based hotspot results endpoint for DBSCAN output
- repository: add memory fallback and Hyperbase repository placeholder
- privacy: keep visitor_id internal and exclude it from frontend-facing responses
```

```txt
feat(frontend): add Mapbox heatmap dashboard

- map: initialize Mapbox centered on Borobudur
- heatmap: render aggregated GeoJSON from backend API
- dashboard: add summary cards for visitors, crowded area, and last updated
- filters: add 5m, 15m, 1h, and today time window controls
- privacy: display only aggregated data and hotspot clusters
```

```txt
chore(repo): add Claude project instructions and docs

- docs: add PRD, API contract, and architecture notes
- claude: define project stack, hard rules, and implementation constraints
- gitignore: ignore node_modules, dist, env files, and generated outputs
```

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This repo uses Next.js 16. APIs, conventions, and file structure may differ from
older Next.js knowledge. Before changing routing, request handling, caching,
proxy behavior, or config, read the relevant guide in
`node_modules/next/dist/docs/` and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Crest House Access Control: Agent Guide

This file exists to reduce ramp-up time and token burn. Read this before making
changes.

## Project Summary

This repository contains two shipped artifacts:

1. The main web app: a Next.js 16 App Router application for managing people,
   vehicles, gate events, sessions, reports, settings, logs, and integrations.
2. A Home Assistant custom integration under
   `custom_components/crest_house_access`.

Both artifacts live in one repo but are versioned independently.

## Source Of Truth

When docs disagree, trust the code and these files first:

- App version: `package.json`
- Home Assistant integration version:
  `custom_components/crest_house_access/manifest.json`
- Database schema and history: `migrations/*.sql`
- Runtime migration behavior: `src/lib/db.ts` and `scripts/migrate.mjs`
- Deployment/runtime behavior: `Dockerfile`, `docker-compose.yaml`,
  `next.config.ts`
- Auth and session behavior: `src/lib/auth.ts`, `src/lib/auth-jwt.ts`,
  `src/proxy.ts`
- Webhook ingest behavior: `src/app/api/webhooks/gate/route.ts`,
  `src/lib/webhook.ts`, `src/lib/webhook-bursts.ts`, `src/lib/sessions.ts`
- Home Assistant API contract:
  `src/app/api/v1/status/route.ts`,
  `src/app/api/v1/stream/route.ts`,
  `src/app/api/v1/gate-signal/route.ts`

Note: prose docs may lag behind code. At the time of writing, `README.md` and
`RELEASING.md` contain older version baselines than the authoritative version
files.

## Stack

- Next.js 16.2.3, App Router
- React 19
- TypeScript
- SQLite via `better-sqlite3`
- Tailwind CSS 4
- PDF generation via `pdfkit`
- Docker / Docker Compose
- Home Assistant custom integration in Python

## Repo Map

Top-level directories that matter:

- `src/app`: App Router pages and API routes
- `src/components`: UI and page-level client components
- `src/lib`: server-side business logic, DB access, auth, reporting, webhook
  handling, SSE, settings, notifications
- `migrations`: ordered SQL migrations
- `scripts/migrate.mjs`: container/startup migration runner
- `data`: runtime SQLite files; treat as live local state, not source
- `custom_components/crest_house_access`: HACS/Home Assistant integration
- `public`: static assets
- `_archive`: historical material, not the active app

Useful route groups:

- `src/app/(auth)`: `/login`, `/setup`
- `src/app/(app)`: authenticated app pages like dashboard, contractors,
  vehicles, review, logs, reports, settings, integrations
- `src/app/api`: browser/admin APIs, public webhook ingest, HA-facing APIs

## Runtime And Build Notes

- Local dev entrypoint: `npm run dev`
- Production build: `npm run build`
- Lint: `npm run lint`
- There are currently no formal unit/integration test scripts in `package.json`.
  If you change behavior, lint and targeted manual verification matter.

Important runtime details:

- `src/lib/db.ts` opens the SQLite DB, enables WAL, turns on foreign keys, and
  runs migrations at app startup.
- `scripts/migrate.mjs` also runs migrations and legacy schema reconciliation.
  Docker runs this before starting the standalone server.
- `next.config.ts` keeps `pdfkit` external and explicitly traces its AFM data
  files for the reports API. Do not casually remove those settings.
- `better-sqlite3` is native; the Dockerfile installs build tooling for it.
- `src/proxy.ts` is intentional. In Next.js 16, `middleware` became `proxy`.
  Do not “fix” this back to old naming.

## Environment Variables

Relevant env vars observed in the app:

- `JWT_SECRET`: required; must be long enough for JWT signing
- `DATABASE_PATH`: optional; defaults to `data/crest-house-access.db` in local
  dev, `/app/data/crest-house-access.db` in the migration script fallback
- `COOKIE_SECURE`: if `"true"`, session cookie is marked secure
- `WEBHOOK_SECRET`: required for `/api/webhooks/gate`
- `HOST_PORT`: used by Docker Compose host port mapping
- `NODE_ENV`: normal Node/Next production mode

Secrets hygiene:

- `.env*` is gitignored
- Never paste or log raw secrets unnecessarily
- If you describe config changes, prefer naming env vars over copying values

## Database And Data Model

The database is SQLite. Migrations are append-only and applied in lexical order.
Do not edit old migrations unless the user explicitly asks for history surgery.
Add a new migration instead.

Core tables:

- `admin_users`: login-capable users; all admins are full-access
- `contractors`: tracked people/vehicles, including family/friends/visitors via
  `role`
- `gate_events`: raw enter/exit events
- `sessions`: derived occupancy sessions with `open`, `closed`, or `flagged`
  status
- `settings`: singleton row with app/report/notification settings
- `webhook_tests`: stored UniFi test events
- `api_keys`: bearer keys for Home Assistant and external API access
- `integration_devices`: device registry
- `audit_logs`: structured app/API/webhook/system log
- `gate_signals`: latest gate state pushed back from Home Assistant
- `webhook_bursts`, `webhook_burst_candidates`: burst-resolution pipeline for
  noisy LPR webhook traffic

Important invariants:

- SQLite runs with WAL mode and foreign keys enabled
- `settings` is a singleton with `id = 1`
- `sessions` are the derived occupancy model; do not bypass session maintenance
  when adding gate-event ingest features
- `gate_events.ingest_key` is used for idempotency
- Unknown webhook plates may remain pending briefly while a burst resolves
- Review workflows depend on `sessions.status = 'flagged'` and review metadata

## Auth And Access Model

- First-run flow goes to `/setup` if no admin exists
- Normal root flow redirects to `/login` or `/dashboard`
- Browser auth uses a JWT session cookie
- Protected app pages are guarded in `src/proxy.ts`
- API routes do their own auth and should return API responses, not login
  redirects
- Home Assistant and other API consumers use bearer tokens from `api_keys`

Do not apply browser redirect assumptions to API routes.

## Webhook Ingest Model

The webhook ingest path is one of the easiest places to break behavior.

Files to read before changing it:

- `src/app/api/webhooks/gate/route.ts`
- `src/lib/webhook.ts`
- `src/lib/webhook-bursts.ts`
- `src/lib/sessions.ts`

Current behavior:

- `/api/webhooks/gate` requires `x-webhook-secret`
- Supports a simple legacy payload and a UniFi Protect / Home Assistant LPR
  payload
- UniFi “testEventId” payloads are recorded in `webhook_tests`
- Real webhook events may use burst resolution:
  - candidates are grouped per source in a 10 second window
  - duplicate `event_id` deliveries are ignored via ingest key logic
  - known plates are preferred
  - only the chosen candidate becomes a `gate_event`
- Auto-direction events resolve to `enter` vs `exit` by checking whether the
  contractor already has an open session
- Session ingest also triggers audit logs, SSE/event bus notifications, and
  optional notification logic

If you change webhook semantics, verify:

- idempotency
- burst resolution
- session open/close/flag behavior
- audit logging
- HA consumers that read recent events and live status

## Home Assistant Contract

The Home Assistant integration is a real deliverable, not just sample code.

Key files:

- `custom_components/crest_house_access/manifest.json`
- `custom_components/crest_house_access/config_flow.py`
- `custom_components/crest_house_access/api.py`
- `custom_components/crest_house_access/coordinator.py`
- `custom_components/crest_house_access/sensor.py`
- `custom_components/crest_house_access/binary_sensor.py`

Integration expectations:

- Polls `GET /api/v1/status` with bearer auth
- Maintains an SSE connection to `GET /api/v1/stream`
- Sends gate state back to `POST /api/v1/gate-signal`
- Fires HA events for arrived/left/access events based on `recent_events`
- Uses `crest_house_access` as the domain

If you change the shape of `/api/v1/status`, `/api/v1/stream`, or
`/api/v1/gate-signal`, inspect the HA integration too. Changes there often
require bumping both artifact versions.

## Reporting

- Reports are generated in `src/app/api/reports/route.ts`
- PDF rendering is in `src/lib/pdf.ts`
- `pdfkit` runtime packaging is deliberate and tied to `next.config.ts`
- Report settings live in the `settings` table, including section order and
  theme metadata

If a report change touches runtime bundling or font data, verify both local dev
and production build assumptions.

## Logging, Realtime, And Notifications

- Audit logs are persisted via `src/lib/audit.ts`
- Internal realtime updates flow through `src/lib/events-bus.ts`
- Browser/HA live views depend on stream endpoints and event emission
- Gate signals from Home Assistant are stored in `gate_signals`

When adding behavior to APIs that affect dashboard or HA state, consider whether
an audit log entry and/or event bus emission is expected.

## Versioning And Releases

This repo has independent version numbers:

- App version: `package.json`
- HA integration version:
  `custom_components/crest_house_access/manifest.json`

Bump rules:

- Bump the app version for web app, API, auth, DB-facing, reporting, or runtime
  behavior changes
- Bump the HA version for integration manifest, entities, translations, config
  flow, polling, or HA compatibility changes
- Bump both when a change affects both surfaces

Tag conventions used by the repo:

- App tags: `app-vX.Y.Z`
- HA tags: `ha-vX.Y.Z`

Do not infer current version baselines from prose docs; read the version files.

## Working Safely In This Repo

- Check `git status` before editing; this repo may have user changes in flight
- Do not revert unrelated changes
- Be careful with `data/*.db`; these are live local databases, not fixtures
- `.db-wal` and `.db-shm` are ignored; the main `.db` files are not
- Avoid destructive cleanup in `data/` unless the user explicitly asks
- Prefer small, surgical changes because behavior spans UI, DB, webhook ingest,
  audit logging, and HA integration

## Verification Checklist

Choose the relevant subset after changes:

- `npm run lint`
- If routing/proxy/auth changed: verify `/`, `/login`, `/setup`, and an
  authenticated app page
- If DB logic changed: inspect migration strategy and avoid mutating old
  migrations
- If webhook logic changed: verify duplicate handling, unknown plate behavior,
  session transitions, and audit log output
- If API contract changed: verify HA-facing routes and check the integration
  code
- If report generation changed: verify build/runtime assumptions for `pdfkit`
- If Docker/runtime files changed: inspect `Dockerfile`,
  `docker-compose.yaml`, and migration startup flow together

## Fast Start For Future Agents

If you only have a minute, read these first:

1. `AGENTS.md`
2. `package.json`
3. `src/lib/db.ts`
4. `src/proxy.ts`
5. The specific route/lib files for the feature you are touching
6. `custom_components/crest_house_access/*` too, if the change touches
   `/api/v1/*` or release/versioning

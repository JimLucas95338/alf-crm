# ALF CRM

A small team CRM for cold-calling assisted living facility (ALF) contacts. Built with Next.js 15 (App Router), Prisma, and SQLite (local dev) / Postgres (production).

## Features

- **Dashboard** — due today, overdue, never called, scheduled-this-week counters with drill-down lists.
- **Contacts** — search + filter by state, status, due-window (today/overdue/7d/30d), called-or-never, last-call range, next-call range; sort by next call / last call / state / status.
- **Contact detail** — full company info, executives, call history, and a "Log a call" form that stamps `lastCallAt`, schedules `nextCallAt`, and updates status.
- **CSV import** — both via the `/import` page (web upload) and a CLI script that loads everything in `alfcontacts/`.
- **HubSpot export** — `/export` page generates two HubSpot-shaped CSVs (Companies + Contacts) with the same filter options as the contacts list. See "Exporting to HubSpot" below.
- **Team auth** — shared team password + per-user email for attribution. Each team member logs in with their own email but shares one secret.

## Local setup

The app uses Postgres (via Prisma) for both dev and prod. Easiest local setup: create a free Neon project at <https://neon.tech>, create a dev branch, and paste its connection string into `.env`.

```bash
cd /Users/jimlucas/Downloads/alf-crm
cp .env.example .env          # then edit with your Neon URL + passwords
npm install
npx prisma db push            # creates tables in the DB referenced by DATABASE_URL
npm run import                # loads /Users/jimlucas/Downloads/alfcontacts/*.csv
npm run dev                   # http://localhost:3000
```

Log in at `/login` with any email + the password in `.env`.

## Environment variables

- `DATABASE_URL` — Postgres connection string (Neon / Vercel Postgres / Supabase).
- `TEAM_PASSWORD` — shared password every team member uses.
- `SESSION_SECRET` — 32+ random chars used to sign session cookies. `openssl rand -hex 32`.

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** for end-to-end deploy to Neon + Vercel (~15 min, $0).

## Data model

- **Contact** — one row per facility (company). Holds CRM state: `status`, `lastCallAt`, `nextCallAt`, `ownerEmail`, `notes`.
- **Executive** — people attached to a contact (primary + up to 5 additional from the source CSVs).
- **Call** — append-only log of calls. Logging a call updates the parent contact's `lastCallAt` / `nextCallAt`.

## Statuses

`new` → `attempted` → `contacted` → `interested` / `not_interested` / `do_not_call`

## Exporting to HubSpot

The `/export` page produces two CSVs that match HubSpot's native import format:

1. **Companies CSV** — one row per facility, mapped to HubSpot company properties (`name`, `domain`, `phone`, `address`, `city`, `state`, `zip`, `website`, `description`, `industry`, `numberofemployees`, `lifecyclestage`, `hs_lead_status`) plus five custom properties carrying CRM state.
2. **Contacts CSV** — one row per executive, linked to its company by `company` name.

**Status mapping:** our `status` field is translated to HubSpot's `lifecyclestage` + `hs_lead_status`:

| Our status | lifecyclestage | hs_lead_status |
|---|---|---|
| new | lead | NEW |
| attempted | lead | ATTEMPTED_TO_CONTACT |
| contacted | lead | CONNECTED |
| interested | opportunity | OPEN_DEAL |
| not_interested | lead | UNQUALIFIED |
| do_not_call | other | BAD_TIMING |

**One-time HubSpot setup** (Settings → Properties → Company → Create property):

- `alf_last_call_date` (Date picker)
- `alf_next_call_date` (Date picker)
- `alf_call_count` (Number)
- `alf_owner_email` (Single-line text)
- `alf_notes` (Multi-line text)

**Import order in HubSpot:** Companies first, then Contacts. HubSpot auto-associates contacts to companies by the `company` column.

**Filters work on export:** any filter you set on `/export` (state, status, date ranges, etc.) narrows both CSVs. Useful for pushing just `interested` leads, or just one region, to HubSpot.

## Adding more CSVs

Drop new files into `/Users/jimlucas/Downloads/alfcontacts/` and run `npm run import` — duplicates are skipped by (company, city, state). Or upload them one at a time via `/import` in the app.

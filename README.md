# kanban mAIster

A **Kanban analytics dashboard** for software delivery teams: ticket flow, quality (First Time Right), and budget tracking across multiple brands — built with Next.js.

It runs in two modes:

| Mode | When | Data |
|---|---|---|
| **Demo** (default) | No environment variables set | ~420 deterministic mock tickets, zero configuration |
| **Live** | `JIRA_*` variables set in `.env` | Real tickets & status history from your **Jira Cloud** project |

---

## Features

| Feature | Description |
|---|---|
| **Flow tab** | Lead time, cumulative time-per-status curves, planned vs actual velocity |
| **Quality tab** | First Time Right (volume / story points / effort), rejection origins (Dev / QA / Business), per-ticket rejection details with comments |
| **Budget tab** | Billed vs planned man-days, cumulative curves, burn rate, forecast |
| **Admin / JH** | Man-day management panel — read-only in demo, **editable in live mode** — plus a toggle to show/hide the Budget tab |
| **EN / FR toggle** | Full bilingual UI via a built-in i18n system |

## Tech Stack

- **Next.js 16** (App Router, React 19, Turbopack) — server components + server actions, no API routes
- **TypeScript** (strict), **Tailwind CSS v4**, **Recharts**, **Zod**

---

## Quickstart (demo mode)

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). No environment variables, no database, no network calls — all data is generated in memory by a seeded RNG (identical on every run):

- ~420 tickets (`DEMO-001`…) across 2026, three brands (GOOG, AAPL, MSFT)
- ~3,000 status transitions with realistic rejection loops (~15%)
- Seasonal financial data (billed days + planned rates)

## Live mode (Jira Cloud)

Set the five required variables in `.env` (copy `.env.example`) and restart:

```bash
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...        # https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_PROJECT_KEY=PROJ
JIRA_BRAND_FIELD=customfield_10050
```

When **all five** are present, the app switches to live mode:

- **Tickets & transitions** are fetched from the Jira Cloud REST API v3
  (`/rest/api/3/search/jql` with `nextPageToken` pagination, plus
  `/rest/api/3/changelog/bulkfetch` for complete status histories) and cached
  in memory for `JIRA_CACHE_TTL` seconds (default 300).
- **Brands** are derived from a Jira custom field on each issue (`JIRA_BRAND_FIELD`);
  select-field options and plain text are both supported. Chart colors are
  assigned automatically.
- **Financial data is not in Jira**: the Budget tab starts empty and the
  **Admin → JH Management** page becomes editable. Billed man-days and planned
  rates you enter are persisted to a local JSON store (`./data/`, gitignored).
- The admin page also gets a **"Show the Budget tab"** toggle if you don't use
  budget tracking.
- If Jira is unreachable or misconfigured, pages show an explicit error (no
  silent fallback to demo data). Details go to the server logs.

### Finding your custom field IDs

```bash
curl -s -u you@example.com:API_TOKEN \
  https://your-site.atlassian.net/rest/api/3/field | jq '.[] | {id, name}'
```

Story points default to `customfield_10016` (the Jira Cloud default); override
with `JIRA_STORY_POINTS_FIELD` if your instance differs.

### Status mapping

The KPI engine reasons about a canonical pipeline:

```
Backlog → In Progress → Review → IT Testing → QA Testing → Business Testing → Ready for Release → Done
```

Backward transitions are counted as rejections and categorized (Dev / QA /
Business) based on the stage they were rejected from. If your workflow uses
different status names, map them with `JIRA_STATUS_MAPPING`:

```bash
JIRA_STATUS_MAPPING={"Code Review":"Review","UAT":"Business Testing","Deployed":"Done"}
```

Keys are case-insensitive; unmapped statuses pass through unchanged.

### Environment variable reference

| Variable | Required for live | Default | Purpose |
|---|---|---|---|
| `JIRA_BASE_URL` | yes | — | `https://your-site.atlassian.net` |
| `JIRA_EMAIL` | yes | — | Atlassian account email |
| `JIRA_API_TOKEN` | yes | — | Jira Cloud API token |
| `JIRA_PROJECT_KEY` | yes | — | Single project to load |
| `JIRA_BRAND_FIELD` | yes | — | Custom field id holding the brand |
| `JIRA_STORY_POINTS_FIELD` | no | `customfield_10016` | Story points field |
| `JIRA_MANDAYS_SOURCE` | no | `timespent` | `timespent` or `timeoriginalestimate` → dev man-days (seconds / 28800) |
| `JIRA_JQL` | no | — | Extra JQL ANDed with `project = KEY` |
| `JIRA_STATUS_MAPPING` | no | identity | JSON map: real status → canonical status |
| `JIRA_CACHE_TTL` | no | `300` | Jira snapshot cache TTL (seconds) |
| `JIRA_MAX_ISSUES` | no | `2000` | Safety cap on fetched issues |
| `DATA_DIR` | no | `./data` | JSON store directory (live mode) |

---

## Architecture

```
src/
  app/                       # Next.js App Router (server components)
    dashboard/               # Flow tab
    quality/                 # Quality tab
    budget/                  # Budget tab (hidable via admin setting)
    admin/(protected)/jh/    # Man-day admin (editable in live mode)
    error.tsx                # Error boundary (Jira failures)
  components/
    layout/                  # Sidebar, date range picker, admin header
    dashboard/               # Charts & KPI components (brand-agnostic)
  lib/
    data-source/             # ★ Mode switch: one interface, two backends
      mock.ts                #   demo  → in-memory generators
      live.ts                #   live  → Jira API + local JSON store
    jira/                    # Jira Cloud client (search, changelogs, comments)
    mock-data/               # Deterministic generators (seeded RNG)
    storage/                 # JSON file store (financial data, settings)
    actions/                 # Server actions: KPI / budget calculations
    i18n/                    # EN/FR translation system
```

The pages and KPI calculations never know which mode is active: they call
server actions, which route through a single `DataSource` interface
(`src/lib/data-source/types.ts`). Mode detection happens server-side only —
no secret ever reaches the browser.

### Data model

```ts
KanbanTicket     { issue_key, brand, issue_type, summary, status,
                   created_date, resolution_date, dev_estimation (SP),
                   dev_mandays, priority }
StatusTransition { issue_key, from_status, to_status, transition_date, author }
BilledDayEntry   { period_type (week|month), period_label, brand, billed_days, ... }
PlannedRate      { brand, daily_rate, effective_from, effective_to }
```

### KPI definitions

- **Lead time**: cumulative working days spent per status (Review → Done) for completed tickets.
- **First Time Right (FTR)**: share of completed tickets that never moved backward in the pipeline. Also weighted by story points and by actual effort.
- **Rejection categories**: a backward transition is attributed to **Dev** (from Review/IT Testing), **QA** (from QA Testing) or **Business** (from Business Testing and beyond).
- **Burn rate**: cumulative billed / planned man-days.

---

## Limitations

- **The JSON store is not durable on serverless hosts** (Vercel/Netlify
  functions have an ephemeral, read-only filesystem). Demo mode deploys
  anywhere; live mode with admin editing needs a host with a persistent disk
  (VPS, Docker volume, Fly.io, Railway, …) or a `DATA_DIR` pointing to one.
- The Jira cache is in-memory and resets on every cold start.
- One Jira project per instance (multi-project support would map naturally to
  the brand field).
- The JSON store is single-process: don't run multiple replicas against the
  same data directory.

## Deploy (demo mode)

Zero configuration required:

```bash
npx vercel
```

## License

[MIT](LICENSE) — © 2026 Benjamin Goalabre

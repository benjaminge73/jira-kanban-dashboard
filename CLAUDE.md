# kanban mAIster

## Purpose

Open-source Kanban analytics dashboard (flow / quality / budget KPIs) with two data modes:

- **Demo mode (default)**: zero config, deterministic mock data (~420 tickets, 2026 only, brands GOOG/AAPL/MSFT). This is the showcase mode — it must keep working with **no environment variables at all**.
- **Live mode**: enabled when `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` and `JIRA_BRAND_FIELD` are all set. Tickets/transitions/comments come from the Jira Cloud REST API v3; financial data (billed man-days, planned rates) and app settings are stored in a local JSON store under `./data/` (gitignored).

## Invariants

- **Demo mode must stay zero-config and byte-identical**: any change must keep `npm run dev` working with no `.env`.
- **Mode detection is server-only** (`src/lib/data-source/mode.ts`). Never expose `JIRA_*` values to the client; the mode reaches client components only via props.
- **No silent fallback**: if Jira fails in live mode, throw — `src/app/error.tsx` renders the error. Log details server-side only.
- Components are **brand-agnostic**: brand lists/colors arrive via props (from `getUiMeta()`), never hardcoded.

## Architecture

```
src/
  proxy.ts                  — pass-through (no auth)
  app/
    layout.tsx              — async; injects mode/showBudgetTab/calendarBounds into Sidebar
    error.tsx               — global error boundary (Jira failures)
    dashboard|quality|budget/page.tsx — server components calling actions
    budget/page.tsx         — redirects to /dashboard when the Budget tab is hidden
    admin/(protected)/
      layout.tsx            — server; renders AdminHeader (demo/live badge)
      jh/page.tsx           — JH admin: read-only in demo, editable in live
  lib/
    data-source/            — ★ the mode switch
      types.ts              — DataSource interface, AppMode, CalendarBounds
      mode.ts               — isLiveMode()/getMode() (env detection, server-only)
      mock.ts               — wraps mock-data module
      live.ts               — Jira (tickets/transitions/comments) + storage (financial)
      index.ts              — getDataSource()
    jira/                   — Jira Cloud client
      config.ts             — zod-validated env (incl. JIRA_STATUS_MAPPING JSON)
      client.ts             — fetch wrapper: Basic auth, 429 retry, search/jql
                              pagination (nextPageToken), changelog/bulkfetch
                              (404 → per-issue fallback), comments
      mapping.ts            — Jira issue → KanbanTicket, changelog → StatusTransition,
                              ADF → text, brand extraction (string | {value} | {name})
      index.ts              — orchestration + TTL snapshot cache on globalThis (single-flight)
    storage/                — JSON file store (live mode persistence)
      json-store.ts         — atomic-ish writes (tmp+rename), per-file write queue
      financial-store.ts    — billedDays/plannedRates CRUD (data/financial.json)
      settings-store.ts     — { showBudgetTab } (data/settings.json)
    actions/                — "use server"
      kpis.ts               — KPI calculations (brand-agnostic, via data source)
      budget.ts             — budget calculations; re-exports types from types/financial
      jh.ts                 — reads via data source; writes: demo=error, live=storage
      settings.ts           — getAppSettings/setShowBudgetTab
      meta.ts               — getUiMeta(): { mode, brands, brandColors } for pages
    mock-data/              — deterministic generators (SeededRandom) — untouched API
    i18n/                   — EN/FR dictionaries (TranslationKey type) + useLanguage()
  types/
    kanban.ts               — KanbanTicket, StatusTransition, BackflowKPIs…
    financial.ts            — BilledDayEntry, PlannedRate, BudgetChartPoint, DateRange
```

## Key behaviors

- **Canonical status pipeline** (KPI/rejection logic depends on these names): Backlog → In Progress → Review → IT Testing → QA Testing → Business Testing → Ready for Release → Done. Real Jira statuses are mapped via `JIRA_STATUS_MAPPING` (case-insensitive keys).
- **dev_mandays** in live mode = `timespent` seconds / 28800 (override with `JIRA_MANDAYS_SOURCE=timeoriginalestimate`).
- **Brands in live mode** = union of brand field values in tickets + brands in the financial store, sorted; colors auto-assigned from a palette. Charts use `var(--brand-<slug>, <fallback>)` so `globals.css` overrides still apply (e.g. `--brand-goog` is overridden to red there).
- **Calendar bounds**: demo `{minYear: 2026, maxYear: 2026}`, live `null` (unrestricted) — via `DataSource.getCalendarBounds()`.
- **Budget tab visibility**: admin toggle (live only; demo always shows it). Sidebar filters the nav item; `/budget` redirects when hidden.

## Env vars

All optional — absence ⇒ demo mode. See `.env.example` for the full reference (`JIRA_*`, `DATA_DIR`).

## Conventions

- i18n: every UI string goes through `t()` with a `TranslationKey`; add EN + FR together.
- After any structural change, update this CLAUDE.md in the same turn.
- `npm run dev` (port 3001), `npm run build`, `npm run lint`, `npx tsc --noEmit`.

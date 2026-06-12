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
  proxy.ts                  — pass-through (no auth; admin auth lives in layouts/actions)
  app/
    layout.tsx              — async; injects mode/showBudgetTab/calendarBounds into Sidebar;
                              renders ConfigWarningBanner when JIRA_* config is partial
    error.tsx               — global error boundary (Jira failures)
    dashboard|quality|budget/page.tsx — server components calling actions
    budget/page.tsx         — redirects to /dashboard when the Budget tab is hidden
    admin/(protected)/
      layout.tsx            — server; auth gate (redirects to /admin/login when
                              ADMIN_PASSWORD is set and no valid session) + AdminHeader
      jh/page.tsx           — JH admin: read-only in demo, editable in live
    admin/login/page.tsx    — password form when ADMIN_PASSWORD is set, else redirect
  lib/
    data-source/            — ★ the mode switch
      types.ts              — DataSource interface, AppMode, CalendarBounds
      mode.ts               — isLiveMode()/getMode() (env detection, server-only)
      mock.ts               — wraps mock-data module
      live.ts               — Jira (tickets/transitions/comments) + storage (financial)
      index.ts              — getDataSource()
    flow/                   — ★ pure Kanban flow logic (unit-tested, no "use server")
      statuses.ts           — canonical pipeline ranks + aliases, isDoneStatus/isWipStatus
      metrics.ts            — cycle time (P50/P85), aging WIP, weekly throughput,
                              Monte Carlo forecast (seeded, deterministic)
    financial/              — pure budget helpers (unit-tested)
      working-days.ts       — shared working-day count (weekends + Jan 1 excluded)
      derive-monthly.ts     — monthly billed entries derived from weekly (pro-rata)
    auth/                   — admin protection (active iff ADMIN_PASSWORD is set)
      token.ts              — stateless HMAC session token (pure, unit-tested)
      admin.ts              — cookie check helpers (server-only)
    jira/                   — Jira Cloud client
      config.ts             — zod-validated env (incl. JIRA_STATUS_MAPPING JSON);
                              partial-config detection (getPartialJiraConfigWarning)
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
      kpis.ts               — KPI calculations (status logic delegated to lib/flow)
      budget.ts             — budget calculations; monthly metrics/chart fall back to
                              weekly-derived data when no monthly entries exist
      jh.ts                 — reads via data source; writes: demo=error, live=storage
                              (+ admin session check when ADMIN_PASSWORD is set)
      settings.ts           — getAppSettings/setShowBudgetTab (same admin check)
      auth.ts               — loginAdmin/logoutAdmin (HMAC cookie)
      meta.ts               — getUiMeta(): { mode, brands, brandColors, showPlannedVsActual }
    mock-data/              — deterministic generators (SeededRandom) — untouched API
    i18n/                   — EN/FR dictionaries (TranslationKey type) + useLanguage()
  types/
    kanban.ts               — KanbanTicket, StatusTransition, BackflowKPIs…
    financial.ts            — BilledDayEntry, PlannedRate, BudgetChartPoint, DateRange
```

## Key behaviors

- **Canonical status pipeline** (KPI/rejection logic depends on these names): Backlog → In Progress → Review → IT Testing → QA Testing → Business Testing → Ready for Release → Done. Real Jira statuses are mapped via `JIRA_STATUS_MAPPING` (case-insensitive keys). All rank/done/WIP logic lives in `src/lib/flow/statuses.ts` — never duplicate status lists elsewhere.
- **Flow KPIs are cycle time, not lead time** (deliberate: lead time = creation → delivery is a future iteration). Cycle time = working days from the first entry into the active pipeline (In Progress…Business Testing) to the last entry into Ready for Release/Done. Cards show P50 (median) with P85 as subtitle. Aging WIP compares in-progress ticket ages to all-time cycle-time P50/P85. The Monte Carlo forecast samples the last ≤26 completed weeks of throughput (hidden below 4 weeks of history); it uses a fixed seed so demo output is stable.
- **Partial Jira config** (some but not all `JIRA_*` set) ⇒ still demo mode, but a warning banner lists the missing variable names (never values) and a server warning is logged once.
- **Admin auth**: active iff `ADMIN_PASSWORD` is set (demo stays zero-config). Gate = `(protected)/layout.tsx` redirect + per-action session check in jh/settings writes. Live without password shows a warning in the admin header.
- **dev_mandays** in live mode = `timespent` seconds / 28800 (override with `JIRA_MANDAYS_SOURCE=timeoriginalestimate`). The dashboard's "Planned vs Actual (Dev)" chart and "Actual / Planned" card are gated by `DataSource.hasMandaysSource()` (→ `UiMeta.showPlannedVsActual`): always shown in demo, shown in live only when `JIRA_MANDAYS_SOURCE` is explicitly set.
- **Brands in live mode** = union of brand field values in tickets + brands in the financial store, sorted; colors auto-assigned from a palette. Charts use `var(--brand-<slug>, <fallback>)` so `globals.css` overrides still apply (e.g. `--brand-goog` is overridden to red there).
- **Calendar bounds**: demo `{minYear: 2026, maxYear: 2026}`, live `null` (unrestricted) — via `DataSource.getCalendarBounds()`.
- **Budget tab visibility**: admin toggle (live only; demo always shows it). Sidebar filters the nav item; `/budget` redirects when hidden. The budget chart defaults to the weekly view (`?view=week` is the implicit default).

## Env vars

All optional — absence ⇒ demo mode. See `.env.example` for the full reference (`JIRA_*`, `DATA_DIR`, `ADMIN_PASSWORD`).

## Conventions

- i18n: every UI string goes through `t()` with a `TranslationKey`; add EN + FR together. (Known leftovers: unit suffixes like "j"/"SP"/"JH" and the "Moyenne" pivot key are still hardcoded.)
- Pure, testable logic goes in `lib/flow` / `lib/financial` / `lib/auth` (no `"use server"`); actions and server components wrap it.
- After any structural change, update this CLAUDE.md in the same turn.
- `npm run dev` (port 3001), `npm run build`, `npm run lint`, `npm test` (vitest), `npx tsc --noEmit`.

import type { KanbanTicket } from "../../types/kanban"
import { SeededRandom, addWorkingDays, toISO } from "./generator"
import { DEMO_BRANDS, type DemoBrand } from "./brands"

// ─── Pools of anonymized summaries ────────────────────────────────────────────

const SUMMARIES = [
  "Implement search filters on dashboard",
  "Fix pagination in data tables",
  "Add CSV export feature",
  "Optimize API response caching",
  "Update authentication middleware",
  "Redesign user profile page",
  "Fix broken link in navigation menu",
  "Add email notification system",
  "Implement dark mode toggle",
  "Fix memory leak in background worker",
  "Add role-based access control",
  "Update dependency versions",
  "Improve error handling in API layer",
  "Add unit tests for billing module",
  "Fix date formatting across locales",
  "Implement audit log viewer",
  "Add bulk delete functionality",
  "Optimize image loading with lazy loading",
  "Fix CORS configuration on staging",
  "Add webhook support for integrations",
  "Refactor authentication flow",
  "Add tooltip components to UI library",
  "Fix timezone handling in reports",
  "Implement retry logic for failed requests",
  "Add onboarding wizard for new users",
  "Fix sorting in analytics dashboard",
  "Implement drag-and-drop interface",
  "Add multi-language support",
  "Fix race condition in concurrent updates",
  "Improve mobile responsiveness",
  "Add keyboard shortcuts for power users",
  "Fix login redirect loop on timeout",
  "Implement data archiving feature",
  "Add progress indicator for long tasks",
  "Refactor database connection pooling",
  "Fix broken OAuth callback",
  "Add custom report builder",
  "Implement two-factor authentication",
  "Fix session expiry handling",
  "Add API rate limiting",
  "Optimize bundle size for production",
  "Fix XSS vulnerability in comment field",
  "Add support for SSO login",
  "Implement real-time notifications",
  "Fix infinite scroll performance issue",
  "Add data validation on form inputs",
  "Refactor legacy payment integration",
  "Fix chart rendering on Safari",
  "Add advanced filtering options",
  "Implement feature flags system",
  "Fix broken pipeline in CI/CD",
  "Add automated regression tests",
  "Optimize SQL queries in reporting",
  "Fix broken PDF generation",
  "Add support for custom domains",
  "Implement activity feed component",
  "Fix error boundary in React app",
  "Add A/B testing framework",
  "Optimize Docker build times",
  "Fix race condition in job queue",
  "Add health check endpoint",
  "Implement content delivery caching",
  "Fix broken link preview in editor",
  "Add OAuth2 scopes management",
  "Refactor notification preferences",
  "Fix incorrect tax calculation",
  "Add support for webhooks payloads",
  "Implement scheduled report delivery",
  "Fix stale data in real-time dashboard",
  "Add database migration tooling",
  "Refactor user settings page",
  "Fix broken image uploads on mobile",
  "Add multi-tenant data isolation",
  "Implement soft-delete for records",
  "Fix performance regression in search",
  "Add support for markdown in comments",
  "Implement token refresh mechanism",
  "Fix 404 error on shared links",
  "Add usage analytics tracking",
]

const ISSUE_TYPES = ["Story", "Story", "Story", "Bug", "Bug", "Task", "Task"]
const PRIORITIES = ["High", "High", "Medium", "Medium", "Medium", "Low"]

// Pipeline statuses for Done tickets
const DONE_STATUSES = ["Done", "Done", "Done", "Ready for Release"]

// ─── Ticket generator ─────────────────────────────────────────────────────────

let cachedTickets: KanbanTicket[] | null = null

export function generateTickets(): KanbanTicket[] {
  if (cachedTickets) return cachedTickets

  const rng = new SeededRandom(42_2026)
  const tickets: KanbanTicket[] = []

  // Target: ~420 tickets distributed across 2026
  // ~35 per month, proportional to brand weights
  const monthlyTargets: Record<DemoBrand, number[]> = {
    GOOG: [],
    AAPL: [],
    MSFT: [],
  }

  // Spread across 12 months of 2026
  for (let month = 1; month <= 12; month++) {
    monthlyTargets.GOOG.push(rng.int(12, 16))
    monthlyTargets.AAPL.push(rng.int(10, 14))
    monthlyTargets.MSFT.push(rng.int(7, 11))
  }

  let counter = 1

  for (let month = 1; month <= 12; month++) {
    for (const brand of DEMO_BRANDS) {
      const count = monthlyTargets[brand][month - 1]

      for (let i = 0; i < count; i++) {
        const issueKey = `DEMO-${String(counter).padStart(3, "0")}`
        counter++

        // Resolution date: spread across the month
        const day = rng.int(1, 28)
        const resDate = new Date(Date.UTC(2026, month - 1, day))
        const resDateStr = toISO(resDate)

        // Created date: brand-specific lead time windows to create visual spread in charts
        // GOOG: fast (10-18 days), AAPL: medium (20-32 days), MSFT: slower (35-55 days)
        const leadTimeDays = brand === "GOOG"
          ? rng.int(10, 18)
          : brand === "MSFT"
          ? rng.int(35, 55)
          : rng.int(20, 32)
        const createdDateRaw = new Date(resDate)
        createdDateRaw.setDate(createdDateRaw.getDate() - leadTimeDays)
        const createdDateStr = toISO(createdDateRaw)

        // Story points (estimation): 1, 2, 3, 5, 8, 13
        const estimationPool = [1, 1, 2, 2, 3, 3, 5, 5, 8, 13]
        const devEstimation = rng.pick(estimationPool)

        // Actual mandays: estimation × (0.75 to 1.35) — realistic variance
        const ratio = rng.float(0.75, 1.35)
        const devMandays = Number((devEstimation * ratio).toFixed(2))

        tickets.push({
          issue_key: issueKey,
          project_key: "DEMO",
          brand,
          issue_type: rng.pick(ISSUE_TYPES),
          summary: rng.pick(SUMMARIES),
          status: rng.pick(DONE_STATUSES),
          created_date: createdDateStr,
          resolution_date: resDateStr,
          dev_estimation: devEstimation,
          dev_mandays: devMandays,
          billed_days: 0,
          priority: rng.pick(PRIORITIES),
        })
      }
    }
  }

  // Add ~20 "in flight" tickets (no resolution date) spread across brands
  for (let i = 0; i < 20; i++) {
    const brand = rng.pick([...DEMO_BRANDS])
    const inFlightStatuses = [
      "In Progress", "Review", "IT Testing", "QA Testing", "Business Testing"
    ]
    tickets.push({
      issue_key: `DEMO-${String(counter).padStart(3, "0")}`,
      project_key: "DEMO",
      brand,
      issue_type: rng.pick(ISSUE_TYPES),
      summary: rng.pick(SUMMARIES),
      status: rng.pick(inFlightStatuses),
      created_date: toISO(new Date(Date.UTC(2026, rng.int(0, 11), rng.int(1, 28)))),
      resolution_date: null,
      dev_estimation: rng.pick([1, 2, 3, 5, 8]),
      dev_mandays: 0,
      billed_days: 0,
      priority: rng.pick(PRIORITIES),
    })
    counter++
  }

  cachedTickets = tickets
  return tickets
}

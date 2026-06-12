/**
 * Mock data layer — fully self-contained, deterministic demo data.
 * All functions are synchronous and return typed data from in-memory generators.
 */

import type { KanbanTicket, StatusTransition } from "../../types/kanban"
import type { BilledDayEntry, PlannedRate, DateRange } from "../../types/financial"
import { generateTickets } from "./tickets"
import { generateTransitions } from "./transitions"
import { generateBilledDays, generatePlannedRates } from "./financial"

// ─── Tickets ──────────────────────────────────────────────────────────────────

export function getMockTickets(): KanbanTicket[] {
  return generateTickets()
}

export function getMockTicketsByPeriod(from: string, to: string): KanbanTicket[] {
  const tickets = generateTickets()
  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime() + 86400000
  return tickets.filter(
    (t) =>
      t.resolution_date &&
      new Date(t.resolution_date).getTime() >= fromMs &&
      new Date(t.resolution_date).getTime() <= toMs
  )
}

// ─── Transitions ─────────────────────────────────────────────────────────────

export function getMockTransitions(): StatusTransition[] {
  return generateTransitions()
}

export function getMockTransitionsByPeriod(from: string, to: string): StatusTransition[] {
  const transitions = generateTransitions()
  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime() + 86400000
  return transitions.filter(
    (t) =>
      new Date(t.transition_date).getTime() >= fromMs &&
      new Date(t.transition_date).getTime() <= toMs
  )
}

// ─── Financial ───────────────────────────────────────────────────────────────

export function getMockBilledDays(
  periodType: "week" | "month",
  dateRange?: DateRange
): BilledDayEntry[] {
  let data = generateBilledDays().filter((e) => e.period_type === periodType && e.year === 2026)
  if (dateRange?.from) {
    data = data.filter((e) => e.end_date >= dateRange.from!)
  }
  if (dateRange?.to) {
    data = data.filter((e) => e.start_date <= dateRange.to!)
  }
  return data
}

export function getMockPlannedRates(): PlannedRate[] {
  return generatePlannedRates()
}

// ─── Rejection comments (anonymized) ─────────────────────────────────────────

const REJECTION_COMMENT_POOL = [
  "Missing unit tests for edge cases.",
  "UI does not match the design specifications.",
  "API response format inconsistent with contract.",
  "Performance regression detected in load tests.",
  "Accessibility requirements not met.",
  "Error handling incomplete on timeout scenarios.",
  "Documentation not updated.",
  "Integration test failing on staging environment.",
  "Security review raised concerns on input validation.",
  "Acceptance criteria not fully implemented.",
]

const AUTHOR_POOL = [
  "Alice D.", "Bob M.", "Casey L.", "Dana R.", "Eli F.",
  "Jordan T.", "Morgan S.", "Riley B.", "Sam P.", "Taylor K.",
]

export function getMockRejectionComments(issueKey: string): Array<{
  author: string
  created: string
  body: string
}> {
  // Use issueKey hash to deterministically pick 1-2 comments
  const hash = issueKey
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const count = (hash % 2) + 1
  const comments = []
  for (let i = 0; i < count; i++) {
    const idx = (hash + i * 7) % REJECTION_COMMENT_POOL.length
    const authorIdx = (hash + i * 3) % AUTHOR_POOL.length
    comments.push({
      author: AUTHOR_POOL[authorIdx],
      created: new Date(2026, (hash % 12), ((hash % 28) + 1)).toISOString(),
      body: REJECTION_COMMENT_POOL[idx],
    })
  }
  return comments
}

export { DEMO_BRANDS, BRAND_COLORS } from "./brands"

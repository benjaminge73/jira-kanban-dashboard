/**
 * Live data source — tickets/transitions/comments from the Jira Cloud API,
 * financial data (billed man-days, planned rates) from the local JSON store.
 */

import type { BilledDayEntry, DateRange } from "../../types/financial"
import { getJiraData, getJiraRejectionComments } from "../jira"
import { getStoredBilledDays, getStoredPlannedRates } from "../storage/financial-store"
import type { DataSource } from "./types"

// Deterministic palette for live brands (assigned by sorted brand name)
const BRAND_PALETTE = [
  "#4285f4", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6",
  "#14b8a6", "#ef4444", "#84cc16", "#06b6d4", "#f97316",
]

function filterBilledDays(
  entries: BilledDayEntry[],
  periodType: "week" | "month",
  dateRange?: DateRange
): BilledDayEntry[] {
  let data = entries.filter((e) => e.period_type === periodType)
  if (dateRange?.from) data = data.filter((e) => e.end_date >= dateRange.from!)
  if (dateRange?.to) data = data.filter((e) => e.start_date <= dateRange.to!)
  return data
}

async function getAllBrands(): Promise<string[]> {
  const [billedDays, plannedRates] = await Promise.all([
    getStoredBilledDays(),
    getStoredPlannedRates(),
  ])
  const brands = new Set<string>()
  // Brand metadata must not take down Jira-independent pages (admin, budget):
  // if Jira is unreachable, fall back to the brands present in the local store.
  try {
    const { tickets } = await getJiraData()
    for (const t of tickets) brands.add(t.brand)
  } catch (err) {
    console.error("[data-source] brands: Jira unavailable, using stored brands only:", err)
  }
  for (const e of billedDays) brands.add(e.brand)
  for (const r of plannedRates) brands.add(r.brand)
  return [...brands].sort()
}

export const liveDataSource: DataSource = {
  mode: "live",

  getTickets: async () => (await getJiraData()).tickets,

  getTicketsByPeriod: async (from, to) => {
    const { tickets } = await getJiraData()
    const fromMs = new Date(from).getTime()
    const toMs = new Date(to).getTime() + 86400000
    return tickets.filter(
      (t) =>
        t.resolution_date &&
        new Date(t.resolution_date).getTime() >= fromMs &&
        new Date(t.resolution_date).getTime() <= toMs
    )
  },

  getTransitions: async () => (await getJiraData()).transitions,

  getTransitionsByPeriod: async (from, to) => {
    const { transitions } = await getJiraData()
    const fromMs = new Date(from).getTime()
    const toMs = new Date(to).getTime() + 86400000
    return transitions.filter(
      (t) =>
        new Date(t.transition_date).getTime() >= fromMs &&
        new Date(t.transition_date).getTime() <= toMs
    )
  },

  getBilledDays: async (periodType, dateRange) =>
    filterBilledDays(await getStoredBilledDays(), periodType, dateRange),

  getPlannedRates: () => getStoredPlannedRates(),

  getRejectionComments: (issueKey, transitionDate) =>
    getJiraRejectionComments(issueKey, transitionDate),

  getBrands: getAllBrands,

  getBrandColors: async () => {
    const brands = await getAllBrands()
    return Object.fromEntries(
      brands.map((brand, i) => [brand, BRAND_PALETTE[i % BRAND_PALETTE.length]])
    )
  },

  getCalendarBounds: () => null,
}

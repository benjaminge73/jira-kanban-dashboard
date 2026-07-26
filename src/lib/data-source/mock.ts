/**
 * Demo data source — thin async wrappers over the deterministic mock module.
 */

import {
  getMockTickets,
  getMockTicketsByPeriod,
  getMockTransitions,
  getMockTransitionsByPeriod,
  getMockBilledDays,
  getMockPlannedRates,
  getMockRejectionComments,
  DEMO_BRANDS,
  BRAND_COLORS,
} from "../mock-data"
import type { DataSource } from "./types"

export const mockDataSource: DataSource = {
  mode: "demo",
  getTickets: async () => getMockTickets(),
  getTicketsByPeriod: async (from, to) => getMockTicketsByPeriod(from, to),
  getTransitions: async () => getMockTransitions(),
  getTransitionsByPeriod: async (from, to) => getMockTransitionsByPeriod(from, to),
  getBilledDays: async (periodType, dateRange) => getMockBilledDays(periodType, dateRange),
  getPlannedRates: async () => getMockPlannedRates(),
  getRejectionComments: async (issueKey) => getMockRejectionComments(issueKey),
  getBrands: async () => [...DEMO_BRANDS],
  getBrandColors: async () => ({ ...BRAND_COLORS }),
  // Demo data covers 2026 only
  getCalendarBounds: () => ({ minYear: 2026, maxYear: 2026 }),
  // Mock tickets always carry dev_mandays — the showcase shows everything
  hasMandaysSource: () => true,
}

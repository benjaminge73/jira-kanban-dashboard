import type { KanbanTicket, StatusTransition } from "../../types/kanban"
import type { BilledDayEntry, PlannedRate, DateRange } from "../../types/financial"

export type AppMode = "demo" | "live"

export interface RejectionComment {
  author: string
  created: string
  body: string
}

export interface CalendarBounds {
  minYear: number
  maxYear: number
}

/**
 * Common contract for the two data backends:
 * - "demo": deterministic in-memory mock data (default, zero config)
 * - "live": Jira Cloud API for tickets/transitions/comments + local JSON store
 *           for financial data
 */
export interface DataSource {
  readonly mode: AppMode
  getTickets(): Promise<KanbanTicket[]>
  getTicketsByPeriod(from: string, to: string): Promise<KanbanTicket[]>
  getTransitions(): Promise<StatusTransition[]>
  getTransitionsByPeriod(from: string, to: string): Promise<StatusTransition[]>
  getBilledDays(periodType: "week" | "month", dateRange?: DateRange): Promise<BilledDayEntry[]>
  getPlannedRates(): Promise<PlannedRate[]>
  getRejectionComments(issueKey: string, transitionDate: string): Promise<RejectionComment[]>
  /** Brands in display order, derived from the data. */
  getBrands(): Promise<string[]>
  /** Hex color per brand (used as chart fallbacks behind CSS variables). */
  getBrandColors(): Promise<Record<string, string>>
  /** Calendar limits for the date pickers; null = unrestricted. */
  getCalendarBounds(): CalendarBounds | null
  /** Whether actual dev man-days have a trusted source (gates the planned-vs-actual UI). */
  hasMandaysSource(): boolean
}

/**
 * Pure Kanban flow metrics: cycle time, aging WIP, throughput and the
 * Monte Carlo forecast. No "use server" here so everything is unit-testable;
 * server components call these directly with data from the data source.
 *
 * Terminology note: we deliberately compute CYCLE TIME (first entry into the
 * active pipeline → delivery), not lead time (creation → delivery), which is
 * a broader notion left for a future iteration.
 */

import { eachDayOfInterval, getISOWeek, getISOWeekYear, isWeekend, startOfISOWeek, addWeeks } from "date-fns"
import type { KanbanTicket, StatusTransition } from "../../types/kanban"
import { isDoneStatus, isWipStatus, statusNameForRank, statusRank } from "./statuses"

/** Inclusive working-day count between two dates (weekends excluded). */
export function workingDaysBetween(start: Date, end: Date): number {
  if (end < start) return 0
  const days = eachDayOfInterval({ start, end })
  return days.filter((d) => !isWeekend(d)).length
}

/** Linear-interpolation percentile (p in [0,1]) of an unsorted sample. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const interpolated = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  return Number(interpolated.toFixed(1))
}

function groupByIssue(transitions: StatusTransition[]): Map<string, StatusTransition[]> {
  const grouped = new Map<string, StatusTransition[]>()
  for (const t of transitions) {
    const list = grouped.get(t.issue_key)
    if (list) list.push(t)
    else grouped.set(t.issue_key, [t])
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => new Date(a.transition_date).getTime() - new Date(b.transition_date).getTime())
  }
  return grouped
}

/** First transition into the active pipeline (In Progress … Business Testing). */
function workStartDate(ticket: KanbanTicket, sorted: StatusTransition[]): Date {
  const entry = sorted.find((t) => {
    const rank = statusRank(t.to_status)
    return rank >= 1 && rank <= 5
  })
  return entry ? new Date(entry.transition_date) : new Date(ticket.created_date)
}

export interface CycleTimeEntry {
  issue_key: string
  brand: string
  cycleDays: number
  completedDate: string
}

/**
 * Cycle time per delivered ticket: working days from the first entry into the
 * active pipeline to the LAST entry into Ready for Release / Done (so a ticket
 * rejected after a premature "done" is measured up to its real completion).
 */
export function computeCycleTimes(
  tickets: KanbanTicket[],
  transitions: StatusTransition[],
  range?: { from?: string; to?: string }
): CycleTimeEntry[] {
  let doneTickets = tickets.filter((t) => isDoneStatus(t.status))
  if (range?.from) {
    const fromMs = new Date(range.from).getTime()
    doneTickets = doneTickets.filter(
      (t) => t.resolution_date && new Date(t.resolution_date).getTime() >= fromMs
    )
  }
  if (range?.to) {
    const toMs = new Date(range.to).getTime() + 86400000
    doneTickets = doneTickets.filter(
      (t) => t.resolution_date && new Date(t.resolution_date).getTime() <= toMs
    )
  }

  const grouped = groupByIssue(transitions)
  const result: CycleTimeEntry[] = []

  for (const ticket of doneTickets) {
    const sorted = grouped.get(ticket.issue_key) ?? []

    let end: Date | null = null
    for (const t of sorted) {
      if (statusRank(t.to_status) >= 6 && isDoneStatus(t.to_status)) {
        end = new Date(t.transition_date)
      }
    }
    if (!end && ticket.resolution_date) end = new Date(ticket.resolution_date)
    if (!end) continue

    const start = workStartDate(ticket, sorted)
    result.push({
      issue_key: ticket.issue_key,
      brand: ticket.brand,
      cycleDays: workingDaysBetween(start, end),
      completedDate: end.toISOString(),
    })
  }

  return result
}

export interface CycleTimeStats {
  count: number
  p50: number | null
  p85: number | null
}

export function cycleTimeStats(entries: CycleTimeEntry[]): CycleTimeStats {
  const days = entries.map((e) => e.cycleDays)
  return { count: days.length, p50: percentile(days, 0.5), p85: percentile(days, 0.85) }
}

export interface AgingWipItem {
  issue_key: string
  summary: string
  brand: string
  status: string
  rank: number
  ageDays: number
}

export interface AgingWipResult {
  /** All tickets currently in a WIP status (card metric). */
  wipCount: number
  /** Tickets whose work demonstrably started in the past (chart points). */
  items: AgingWipItem[]
}

export function computeAgingWip(
  tickets: KanbanTicket[],
  transitions: StatusTransition[],
  now: Date
): AgingWipResult {
  const wipTickets = tickets.filter((t) => isWipStatus(t.status))
  const grouped = groupByIssue(transitions)
  const items: AgingWipItem[] = []

  for (const ticket of wipTickets) {
    const sorted = grouped.get(ticket.issue_key) ?? []
    const start = workStartDate(ticket, sorted)
    const ageDays = workingDaysBetween(start, now)
    if (ageDays < 1) continue // not started yet (or future-dated demo ticket)
    items.push({
      issue_key: ticket.issue_key,
      summary: ticket.summary,
      brand: ticket.brand,
      status: statusNameForRank(statusRank(ticket.status)),
      rank: statusRank(ticket.status),
      ageDays,
    })
  }

  items.sort((a, b) => b.ageDays - a.ageDays)
  return { wipCount: wipTickets.length, items }
}

export interface ThroughputPoint {
  period: string
  [brand: string]: number | string
}

function isoWeekLabel(date: Date): string {
  return `W${String(getISOWeek(date)).padStart(2, "0")} ${getISOWeekYear(date)}`
}

/**
 * Delivered tickets per ISO week, by brand. Weeks without completions inside
 * the covered range are emitted with zeros so the run chart shows real gaps.
 */
export function computeWeeklyThroughput(
  tickets: KanbanTicket[],
  brands: string[],
  range?: { from?: string; to?: string }
): ThroughputPoint[] {
  let doneTickets = tickets.filter((t) => isDoneStatus(t.status) && t.resolution_date)
  if (range?.from) {
    const fromMs = new Date(range.from).getTime()
    doneTickets = doneTickets.filter((t) => new Date(t.resolution_date!).getTime() >= fromMs)
  }
  if (range?.to) {
    const toMs = new Date(range.to).getTime() + 86400000
    doneTickets = doneTickets.filter((t) => new Date(t.resolution_date!).getTime() <= toMs)
  }
  if (doneTickets.length === 0) return []

  const resolutionDates = doneTickets.map((t) => new Date(t.resolution_date!).getTime())
  const rangeStart = range?.from ? new Date(range.from) : new Date(Math.min(...resolutionDates))
  const rangeEnd = range?.to ? new Date(range.to) : new Date(Math.max(...resolutionDates))

  const points = new Map<string, ThroughputPoint>()
  const emptyPoint = (label: string): ThroughputPoint => {
    const p: ThroughputPoint = { period: label }
    for (const brand of brands) p[brand] = 0
    return p
  }

  // Seed every week of the range in chronological order
  let cursor = startOfISOWeek(rangeStart)
  const endWeek = startOfISOWeek(rangeEnd)
  while (cursor <= endWeek) {
    const label = isoWeekLabel(cursor)
    if (!points.has(label)) points.set(label, emptyPoint(label))
    cursor = addWeeks(cursor, 1)
  }

  for (const ticket of doneTickets) {
    const label = isoWeekLabel(new Date(ticket.resolution_date!))
    if (!points.has(label)) points.set(label, emptyPoint(label))
    const point = points.get(label)!
    point[ticket.brand] = ((point[ticket.brand] as number) || 0) + 1
  }

  return [...points.values()]
}

/**
 * Total weekly throughput history for the forecast: the last `maxWeeks`
 * COMPLETED ISO weeks before `now` (the current, partial week is excluded),
 * starting no earlier than the first delivery. Zero weeks count as zero.
 */
export function throughputHistory(
  tickets: KanbanTicket[],
  now: Date,
  maxWeeks = 26
): number[] {
  const doneTickets = tickets.filter((t) => isDoneStatus(t.status) && t.resolution_date)
  if (doneTickets.length === 0) return []

  const countsByWeekStart = new Map<number, number>()
  let firstWeekStart: number | null = null
  for (const ticket of doneTickets) {
    const weekStart = startOfISOWeek(new Date(ticket.resolution_date!)).getTime()
    countsByWeekStart.set(weekStart, (countsByWeekStart.get(weekStart) || 0) + 1)
    if (firstWeekStart === null || weekStart < firstWeekStart) firstWeekStart = weekStart
  }

  const currentWeekStart = startOfISOWeek(now).getTime()
  if (firstWeekStart === null || firstWeekStart >= currentWeekStart) return []

  const history: number[] = []
  let cursor = new Date(firstWeekStart)
  while (cursor.getTime() < currentWeekStart) {
    history.push(countsByWeekStart.get(cursor.getTime()) || 0)
    cursor = addWeeks(cursor, 1)
  }
  return history.slice(-maxWeeks)
}

/** Deterministic PRNG (mulberry32) so the forecast is stable between renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ForecastRow {
  weeks: number
  /** 85% of simulations complete at least this many tickets. */
  p85: number
  /** Median outcome. */
  p50: number
}

/**
 * Monte Carlo "how many items" forecast: sample past weekly throughput with
 * replacement over each horizon, 10k runs. p85 is the 15th percentile of the
 * simulated totals (≥ this count with 85% confidence).
 */
export function monteCarloForecast(
  history: number[],
  horizons: number[],
  iterations = 10000,
  seed = 0xc0ffee
): ForecastRow[] {
  if (history.length === 0) return []
  const rand = mulberry32(seed)

  return horizons.map((weeks) => {
    const totals: number[] = new Array(iterations)
    for (let i = 0; i < iterations; i++) {
      let total = 0
      for (let w = 0; w < weeks; w++) {
        total += history[Math.floor(rand() * history.length)]
      }
      totals[i] = total
    }
    return {
      weeks,
      p85: Math.round(percentile(totals, 0.15) ?? 0),
      p50: Math.round(percentile(totals, 0.5) ?? 0),
    }
  })
}

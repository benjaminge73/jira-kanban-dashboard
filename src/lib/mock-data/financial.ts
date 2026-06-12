import type { BilledDayEntry, PlannedRate } from "../../types/financial"
import { SeededRandom } from "./generator"
import { DEMO_BRANDS } from "./brands"
import {
  endOfWeek, getISOWeek, getYear,
  eachWeekOfInterval, format, endOfMonth, getMonth
} from "date-fns"

// ─── Seasonal profiles (index 0 = Jan, 11 = Dec) ────────────────────────────
// Values in [0, 1] — 0 = near brand floor, 1 = near brand ceiling
const plannedSeasonality = [0.30, 0.45, 0.65, 0.75, 0.80, 0.55, 0.35, 0.50, 0.70, 0.90, 0.85, 0.60]
const billedSeasonality  = [0.25, 0.50, 0.70, 0.65, 0.85, 0.50, 0.30, 0.45, 0.75, 0.95, 0.80, 0.55]

// Brand ranges — kept non-overlapping to ensure clear visual separation
// Planned: floor/ceiling in JH/month
const PLANNED_RANGE: Record<string, [number, number]> = {
  GOOG: [16, 29],
  AAPL: [10, 18],
  MSFT: [4,  9],
}
// Billed: floor/ceiling in JH/month
const BILLED_RANGE: Record<string, [number, number]> = {
  GOOG: [15, 30],
  AAPL: [9,  17],
  MSFT: [3,  8],
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

// ─── Planned Rates ────────────────────────────────────────────────────────────

let cachedPlannedRates: PlannedRate[] | null = null

export function generatePlannedRates(): PlannedRate[] {
  if (cachedPlannedRates) return cachedPlannedRates

  const rng = new SeededRandom(42_2026)
  let id = 1
  const rates: PlannedRate[] = []

  for (let month = 1; month <= 12; month++) {
    const mIdx = month - 1
    const startStr = `2026-${String(month).padStart(2, "0")}-01`
    const endDate = new Date(Date.UTC(2026, month, 0))
    const endStr = endDate.toISOString().slice(0, 10)

    for (const brand of DEMO_BRANDS) {
      const [lo, hi] = PLANNED_RANGE[brand]
      // Seasonal position + per-brand independent noise
      const noise = rng.float(-0.15, 0.15)
      const t = plannedSeasonality[mIdx] + noise
      const planned = Number(lerp(lo, hi, t).toFixed(1))

      rates.push({
        id: id++,
        brand,
        daily_rate: planned,
        effective_from: startStr,
        effective_to: endStr,
      })
    }
  }

  cachedPlannedRates = rates
  return rates
}

// ─── Billed Days ──────────────────────────────────────────────────────────────

let cachedBilledDays: BilledDayEntry[] | null = null

export function generateBilledDays(): BilledDayEntry[] {
  if (cachedBilledDays) return cachedBilledDays

  const rng = new SeededRandom(77_2026)
  const entries: BilledDayEntry[] = []
  let id = 1

  // Monthly billing — each brand has independent seasonal noise
  const monthlyActuals: Record<string, number[]> = { GOOG: [], AAPL: [], MSFT: [] }

  for (let mIdx = 0; mIdx < 12; mIdx++) {
    for (const brand of DEMO_BRANDS) {
      const [lo, hi] = BILLED_RANGE[brand]
      // Each brand gets its own noise so curves are not in lockstep
      const noise = rng.float(-0.18, 0.18)
      const t = billedSeasonality[mIdx] + noise
      const billed = Number(lerp(lo, hi, t).toFixed(1))
      monthlyActuals[brand].push(billed)
    }
  }

  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(Date.UTC(2026, month - 1, 1))
    const endDate = endOfMonth(startDate)
    const endDateStr = format(endDate, "yyyy-MM-dd")
    const startDateStr = format(startDate, "yyyy-MM-dd")
    const monthLabel = format(startDate, "MMM yyyy")

    for (const brand of DEMO_BRANDS) {
      entries.push({
        id: id++,
        period_type: "month",
        period_label: monthLabel,
        brand,
        billed_days: monthlyActuals[brand][month - 1],
        year: 2026,
        week_number: null,
        month_number: month,
        start_date: startDateStr,
        end_date: endDateStr,
      })
    }
  }

  // Weekly billing — derived from monthly actuals ± small per-week noise
  const year2026Start = new Date(Date.UTC(2026, 0, 1))
  const year2026End = new Date(Date.UTC(2026, 11, 31))

  const allMondays = eachWeekOfInterval(
    { start: year2026Start, end: year2026End },
    { weekStartsOn: 1 }
  )

  for (const weekStart of allMondays) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const isoWeek = getISOWeek(weekStart)
    const weekYear = getYear(weekStart)

    if (weekYear !== 2026 && getYear(weekEnd) !== 2026) continue

    const weekStartStr = format(weekStart, "yyyy-MM-dd")
    const weekEndStr = format(weekEnd, "yyyy-MM-dd")
    const weekLabel = `S${String(isoWeek).padStart(2, "0")} ${weekYear}`
    const monthNumber = weekStart.getMonth() + 1

    for (const brand of DEMO_BRANDS) {
      const monthIdx = getMonth(weekStart)
      const monthlyVal = monthlyActuals[brand][monthIdx] || 0
      // Weekly = monthly / 4.33 ± ~20% noise for less smoothness
      const approxWeekly = Number((monthlyVal / 4.33 + rng.float(-0.8, 0.8)).toFixed(1))

      entries.push({
        id: id++,
        period_type: "week",
        period_label: weekLabel,
        brand,
        billed_days: Math.max(0.1, approxWeekly),
        year: weekYear,
        week_number: isoWeek,
        month_number: monthNumber,
        start_date: weekStartStr,
        end_date: weekEndStr,
      })
    }
  }

  cachedBilledDays = entries
  return entries
}

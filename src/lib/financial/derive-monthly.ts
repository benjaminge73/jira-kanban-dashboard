/**
 * Derives monthly billed entries from weekly ones, so live users who only
 * fill in the weekly JH grid still get budget cards and the monthly chart.
 * Boundary weeks (spanning two months) are split pro-rata on working days.
 * Pure module — monthly entries, when present, always take precedence.
 */

import { endOfMonth, format, parseISO } from "date-fns"
import type { BilledDayEntry } from "../../types/financial"
import { getWorkingDaysInRange } from "./working-days"

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // yyyy-MM
}

function monthBounds(key: string): { start: string; end: string } {
  const start = `${key}-01`
  return { start, end: format(endOfMonth(parseISO(start)), "yyyy-MM-dd") }
}

export function deriveMonthlyFromWeekly(weekly: BilledDayEntry[]): BilledDayEntry[] {
  // billed days per brand per month
  const totals = new Map<string, number>()

  for (const entry of weekly) {
    const startMonth = monthKey(entry.start_date)
    const endMonth = monthKey(entry.end_date)

    if (startMonth === endMonth) {
      const key = `${entry.brand}|${startMonth}`
      totals.set(key, (totals.get(key) || 0) + entry.billed_days)
      continue
    }

    // Boundary week: split between the two months by working days
    const firstMonthEnd = monthBounds(startMonth).end
    const secondMonthStart = monthBounds(endMonth).start
    const wdFirst = getWorkingDaysInRange(entry.start_date, firstMonthEnd)
    const wdSecond = getWorkingDaysInRange(secondMonthStart, entry.end_date)
    const wdTotal = wdFirst + wdSecond

    const firstShare = wdTotal > 0 ? entry.billed_days * (wdFirst / wdTotal) : entry.billed_days
    const keyFirst = `${entry.brand}|${startMonth}`
    const keySecond = `${entry.brand}|${endMonth}`
    totals.set(keyFirst, (totals.get(keyFirst) || 0) + firstShare)
    totals.set(keySecond, (totals.get(keySecond) || 0) + (entry.billed_days - firstShare))
  }

  const result: BilledDayEntry[] = []
  let syntheticId = -1
  for (const [key, billed] of totals) {
    const [brand, month] = key.split("|")
    const bounds = monthBounds(month)
    const parsed = parseISO(bounds.start)
    result.push({
      id: syntheticId--,
      period_type: "month",
      period_label: format(parsed, "MMM yyyy"),
      brand,
      billed_days: Number(billed.toFixed(1)),
      year: parsed.getFullYear(),
      week_number: null,
      month_number: parsed.getMonth() + 1,
      start_date: bounds.start,
      end_date: bounds.end,
    })
  }

  result.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.brand.localeCompare(b.brand))
  return result
}

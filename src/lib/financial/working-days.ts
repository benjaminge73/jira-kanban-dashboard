/**
 * Working-day count used by budget computations: weekends and January 1st
 * excluded. Pure module (shared by budget actions and tests).
 */

import { eachDayOfInterval, isWeekend, parseISO } from "date-fns"

export function getWorkingDaysInRange(startStr: string, endStr: string): number {
  const start = parseISO(startStr)
  const end = parseISO(endStr)
  if (end < start) return 0
  const days = eachDayOfInterval({ start, end })
  return days.filter((d) => {
    if (isWeekend(d)) return false
    if (d.getMonth() === 0 && d.getDate() === 1) return false
    return true
  }).length
}

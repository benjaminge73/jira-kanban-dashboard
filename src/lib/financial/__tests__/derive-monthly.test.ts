import { describe, expect, it } from "vitest"
import type { BilledDayEntry } from "../../../types/financial"
import { deriveMonthlyFromWeekly } from "../derive-monthly"
import { getWorkingDaysInRange } from "../working-days"

function weekEntry(overrides: Partial<BilledDayEntry>): BilledDayEntry {
  return {
    id: 1,
    period_type: "week",
    period_label: "S02 2026",
    brand: "ACME",
    billed_days: 5,
    year: 2026,
    week_number: 2,
    month_number: 1,
    start_date: "2026-01-05",
    end_date: "2026-01-11",
    ...overrides,
  }
}

describe("getWorkingDaysInRange", () => {
  it("excludes weekends and January 1st", () => {
    // Thu 2026-01-01 (excluded) + Fri 2026-01-02
    expect(getWorkingDaysInRange("2026-01-01", "2026-01-02")).toBe(1)
    // Full week Mon–Sun
    expect(getWorkingDaysInRange("2026-01-05", "2026-01-11")).toBe(5)
  })
})

describe("deriveMonthlyFromWeekly", () => {
  it("attributes a mid-month week entirely to its month", () => {
    const result = deriveMonthlyFromWeekly([weekEntry({})])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      period_type: "month",
      brand: "ACME",
      billed_days: 5,
      month_number: 1,
      year: 2026,
      start_date: "2026-01-01",
      end_date: "2026-01-31",
    })
  })

  it("splits a boundary week pro-rata on working days", () => {
    // Mon 2026-03-30 → Sun 2026-04-05: 2 working days in March, 3 in April
    const result = deriveMonthlyFromWeekly([
      weekEntry({ start_date: "2026-03-30", end_date: "2026-04-05", billed_days: 5, month_number: 3 }),
    ])
    const march = result.find((e) => e.month_number === 3)
    const april = result.find((e) => e.month_number === 4)
    expect(march?.billed_days).toBe(2)
    expect(april?.billed_days).toBe(3)
  })

  it("aggregates several weeks of the same brand and month", () => {
    const result = deriveMonthlyFromWeekly([
      weekEntry({ id: 1, billed_days: 5 }),
      weekEntry({ id: 2, week_number: 3, start_date: "2026-01-12", end_date: "2026-01-18", billed_days: 4.5 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].billed_days).toBe(9.5)
  })

  it("keeps brands separate", () => {
    const result = deriveMonthlyFromWeekly([
      weekEntry({ brand: "ACME" }),
      weekEntry({ brand: "OTHER", billed_days: 2 }),
    ])
    expect(result.map((e) => `${e.brand}:${e.billed_days}`).sort()).toEqual(["ACME:5", "OTHER:2"])
  })
})

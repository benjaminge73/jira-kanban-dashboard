import { describe, expect, it } from "vitest"
import type { KanbanTicket, StatusTransition } from "../../../types/kanban"
import {
  computeAgingWip,
  computeCycleTimes,
  computeWeeklyThroughput,
  cycleTimeStats,
  monteCarloForecast,
  percentile,
  throughputHistory,
  workingDaysBetween,
} from "../metrics"

function makeTicket(overrides: Partial<KanbanTicket>): KanbanTicket {
  return {
    issue_key: "T-1",
    project_key: "T",
    brand: "ACME",
    issue_type: "Story",
    summary: "A ticket",
    status: "Done",
    created_date: "2026-01-05",
    resolution_date: "2026-01-16",
    dev_estimation: 3,
    dev_mandays: 2,
    billed_days: 0,
    priority: null,
    ...overrides,
  }
}

let transitionId = 1
function makeTransition(issueKey: string, from: string | null, to: string, date: string): StatusTransition {
  return {
    id: transitionId++,
    issue_key: issueKey,
    from_status: from,
    to_status: to,
    transition_date: `${date}T10:00:00.000Z`,
    author: null,
  }
}

describe("workingDaysBetween", () => {
  it("counts inclusive working days and skips weekends", () => {
    // Mon 2026-01-05 → Fri 2026-01-16: two full weeks
    expect(workingDaysBetween(new Date("2026-01-05"), new Date("2026-01-16"))).toBe(10)
    // Same day
    expect(workingDaysBetween(new Date("2026-01-05"), new Date("2026-01-05"))).toBe(1)
    // Inverted range
    expect(workingDaysBetween(new Date("2026-01-16"), new Date("2026-01-05"))).toBe(0)
  })
})

describe("percentile", () => {
  it("interpolates linearly", () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5)
    expect(percentile([4, 1, 3, 2], 0.85)).toBe(3.5)
    expect(percentile([7], 0.85)).toBe(7)
  })

  it("returns null on empty input", () => {
    expect(percentile([], 0.5)).toBeNull()
  })
})

describe("computeCycleTimes", () => {
  const tickets = [
    // Straight run: In Progress Mon 01-05 → Done Fri 01-16 = 10 working days
    makeTicket({ issue_key: "T-1", status: "Done", resolution_date: "2026-01-16" }),
    // Rejected after a premature Ready for Release: measured up to the real completion
    makeTicket({ issue_key: "T-2", status: "Done", resolution_date: "2026-01-12" }),
    // Done ticket without transitions: falls back to created_date → resolution_date
    makeTicket({ issue_key: "T-3", status: "Done", created_date: "2026-01-05", resolution_date: "2026-01-09" }),
    // Canceled tickets are not delivered work
    makeTicket({ issue_key: "T-4", status: "Canceled", resolution_date: "2026-01-16" }),
  ]
  const transitions = [
    makeTransition("T-1", "Backlog", "In Progress", "2026-01-05"),
    makeTransition("T-1", "In Progress", "Review", "2026-01-08"),
    makeTransition("T-1", "Review", "Done", "2026-01-16"),

    makeTransition("T-2", "Backlog", "In Progress", "2026-01-05"),
    makeTransition("T-2", "In Progress", "Ready for Release", "2026-01-07"),
    makeTransition("T-2", "Ready for Release", "QA Testing", "2026-01-08"),
    makeTransition("T-2", "QA Testing", "Done", "2026-01-12"),
  ]

  it("measures work start → last delivery entry in working days", () => {
    const entries = computeCycleTimes(tickets, transitions)
    const byKey = Object.fromEntries(entries.map((e) => [e.issue_key, e.cycleDays]))

    expect(byKey["T-1"]).toBe(10)
    // T-2: Mon 01-05 → Mon 01-12 = 6 working days (not the premature 01-07 exit)
    expect(byKey["T-2"]).toBe(6)
    // T-3: created Mon 01-05 → resolved Fri 01-09 = 5 working days
    expect(byKey["T-3"]).toBe(5)
    expect(byKey["T-4"]).toBeUndefined()
  })

  it("filters by resolution date range", () => {
    const entries = computeCycleTimes(tickets, transitions, { from: "2026-01-10", to: "2026-01-13" })
    expect(entries.map((e) => e.issue_key)).toEqual(["T-2"])
  })

  it("aggregates into P50/P85 stats", () => {
    const stats = cycleTimeStats(computeCycleTimes(tickets, transitions))
    expect(stats.count).toBe(3)
    expect(stats.p50).toBe(6)
    expect(stats.p85).toBeGreaterThanOrEqual(stats.p50!)
  })
})

describe("computeAgingWip", () => {
  const now = new Date("2026-06-12") // Friday
  const tickets = [
    // Started Mon 06-08 → age 5 working days
    makeTicket({ issue_key: "W-1", status: "Review", resolution_date: null }),
    // Future-dated start (demo artifact): counted in WIP but not chartable
    makeTicket({ issue_key: "W-2", status: "In Progress", resolution_date: null, created_date: "2026-07-01" }),
    // Backlog is not WIP
    makeTicket({ issue_key: "W-3", status: "Backlog", resolution_date: null }),
    // Delivered is not WIP
    makeTicket({ issue_key: "W-4", status: "Done" }),
  ]
  const transitions = [
    makeTransition("W-1", "Backlog", "In Progress", "2026-06-08"),
    makeTransition("W-1", "In Progress", "Review", "2026-06-10"),
    makeTransition("W-2", "Backlog", "In Progress", "2026-07-01"),
  ]

  it("computes age since work start for in-progress tickets only", () => {
    const result = computeAgingWip(tickets, transitions, now)
    expect(result.wipCount).toBe(2)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ issue_key: "W-1", status: "Review", rank: 2, ageDays: 5 })
  })
})

describe("computeWeeklyThroughput", () => {
  it("groups deliveries by ISO week and fills gaps with zeros", () => {
    const tickets = [
      makeTicket({ issue_key: "T-1", brand: "A", resolution_date: "2026-01-07" }), // W02
      makeTicket({ issue_key: "T-2", brand: "B", resolution_date: "2026-01-07" }), // W02
      makeTicket({ issue_key: "T-3", brand: "A", resolution_date: "2026-01-22" }), // W04
      makeTicket({ issue_key: "T-4", brand: "A", status: "In Progress", resolution_date: null }),
    ]
    const points = computeWeeklyThroughput(tickets, ["A", "B"])
    expect(points.map((p) => p.period)).toEqual(["W02 2026", "W03 2026", "W04 2026"])
    expect(points[0]).toMatchObject({ A: 1, B: 1 })
    expect(points[1]).toMatchObject({ A: 0, B: 0 })
    expect(points[2]).toMatchObject({ A: 1, B: 0 })
  })

  it("assigns end-of-year deliveries to the right ISO week-year", () => {
    const tickets = [makeTicket({ resolution_date: "2025-12-31" })] // Wednesday of W01 2026
    const points = computeWeeklyThroughput(tickets, ["ACME"])
    expect(points[0].period).toBe("W01 2026")
  })
})

describe("throughputHistory", () => {
  it("returns completed weeks only, oldest first, zeros included", () => {
    const tickets = [
      makeTicket({ issue_key: "T-1", resolution_date: "2026-01-01" }), // W01
      makeTicket({ issue_key: "T-2", resolution_date: "2026-01-02" }), // W01
      makeTicket({ issue_key: "T-3", resolution_date: "2026-01-07" }), // W02
      // W03: nothing
      makeTicket({ issue_key: "T-4", resolution_date: "2026-01-22" }), // W04 = current week → excluded
    ]
    const history = throughputHistory(tickets, new Date("2026-01-22"))
    expect(history).toEqual([2, 1, 0])
  })

  it("returns empty when there is no completed week before now", () => {
    const tickets = [makeTicket({ resolution_date: "2026-01-22" })]
    expect(throughputHistory(tickets, new Date("2026-01-22"))).toEqual([])
  })
})

describe("monteCarloForecast", () => {
  it("is deterministic for a given seed", () => {
    const history = [0, 1, 5, 10, 3, 2]
    const a = monteCarloForecast(history, [2, 4, 8])
    const b = monteCarloForecast(history, [2, 4, 8])
    expect(a).toEqual(b)
  })

  it("is exact for a constant history", () => {
    const rows = monteCarloForecast([3, 3, 3], [4])
    expect(rows[0]).toEqual({ weeks: 4, p85: 12, p50: 12 })
  })

  it("keeps the 85% figure at or below the median", () => {
    const rows = monteCarloForecast([0, 1, 5, 10], [4, 8])
    for (const row of rows) {
      expect(row.p85).toBeLessThanOrEqual(row.p50)
      expect(row.p85).toBeGreaterThanOrEqual(0)
    }
  })

  it("returns nothing without history", () => {
    expect(monteCarloForecast([], [4])).toEqual([])
  })
})

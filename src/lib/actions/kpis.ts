"use server"

import { isWeekend, eachDayOfInterval, getISOWeek, getYear, format } from "date-fns"
import type { KanbanTicket, StatusTransition, BackflowKPIs } from "../../types/kanban"
import { getDataSource } from "../data-source"

// Note: Lightweight implementation of working days (weekends excluded).
function getWorkingDaysCount(startDate: Date, endDate: Date): number {
  if (endDate < startDate) return 0
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  return days.filter((d) => !isWeekend(d)).length
}

export async function fetchTicketsByPeriod(startDate: string, endDate: string): Promise<KanbanTicket[]> {
  return getDataSource().getTicketsByPeriod(startDate, endDate)
}

export async function calculateVelocityDeltas(tickets: KanbanTicket[]) {
  const doneStatuses = ["Done", "Ready for Release", "done", "ready for release"]
  const doneTickets = tickets.filter((t) =>
    doneStatuses.includes(t.status) || doneStatuses.includes(t.status.toLowerCase())
  )

  return doneTickets.map((ticket) => {
    const deltaJh = ticket.dev_mandays - ticket.dev_estimation
    const deltaPct = ticket.dev_estimation > 0 ? (deltaJh / ticket.dev_estimation) * 100 : 0
    return { ...ticket, delta_jh: deltaJh, delta_pct: deltaPct }
  })
}

export async function calculateBudgetProrata(billedDays: number, startDateStr: string, endDateStr: string) {
  const { parseISO } = await import("date-fns")
  const startDate = parseISO(startDateStr)
  const endDate = parseISO(endDateStr)

  const workingDays = getWorkingDaysCount(startDate, endDate)
  if (workingDays <= 0) return []

  const dailyRate = billedDays / workingDays
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const records = []
  let cumulative = 0.0

  for (const d of days) {
    if (!isWeekend(d)) {
      cumulative += dailyRate
      records.push({
        date: d.toISOString().split("T")[0],
        expected_cumulative_budget: cumulative,
      })
    }
  }

  return records
}

export async function calculateTimeSpentPerStatus(
  tickets: KanbanTicket[],
  transitions: StatusTransition[],
  fromStr?: string,
  toStr?: string
) {
  // Target statuses with display names (post-rename)
  const targetStatuses = [
    { key: "review",           display: "Review" },
    { key: "it testing",       display: "IT Testing" },
    { key: "qa testing",       display: "QA Testing" },
    { key: "business testing", display: "Business Testing" },
    { key: "ready for release",display: "Ready For Release" },
    { key: "done",             display: "Done" },
  ]

  const records: any[] = []

  const doneStatuses = ["Done", "Ready for Release", "done", "ready for release"]
  let doneTickets = tickets.filter(
    (t) => doneStatuses.includes(t.status) || doneStatuses.includes(t.status.toLowerCase())
  )

  if (fromStr) {
    const fromDate = new Date(fromStr).getTime()
    doneTickets = doneTickets.filter(
      (t) => t.resolution_date && new Date(t.resolution_date).getTime() >= fromDate
    )
  }
  if (toStr) {
    const toDate = new Date(toStr).getTime() + 86400000
    doneTickets = doneTickets.filter(
      (t) => t.resolution_date && new Date(t.resolution_date).getTime() <= toDate
    )
  }

  const doneKeys = new Set(doneTickets.map((t) => t.issue_key))
  const filteredTransitions = transitions.filter((t) => doneKeys.has(t.issue_key))

  const grouped = filteredTransitions.reduce(
    (acc, t) => {
      if (!acc[t.issue_key]) acc[t.issue_key] = []
      acc[t.issue_key].push(t)
      return acc
    },
    {} as Record<string, StatusTransition[]>
  )

  for (const [issueKey, group] of Object.entries(grouped)) {
    group.sort((a, b) => new Date(a.transition_date).getTime() - new Date(b.transition_date).getTime())

    const brand = doneTickets.find((t) => t.issue_key === issueKey)?.brand || "Unknown"

    // Compute per-status time: time spent exclusively in each status
    for (const { key, display } of targetStatuses) {
      // Find all times the ticket entered this status
      const entryTransitions = group.filter(
        (t) => t.to_status?.toLowerCase() === key
      )

      if (entryTransitions.length === 0) continue

      let totalDays = 0
      let count = 0

      for (const entry of entryTransitions) {
        const entryTime = new Date(entry.transition_date).getTime()

        // Find the next transition that leaves this status (from_status === key)
        const exit = group.find(
          (t) =>
            t.from_status?.toLowerCase() === key &&
            new Date(t.transition_date).getTime() > entryTime
        )

        if (exit) {
          const exitTime = new Date(exit.transition_date)
          const entryDate = new Date(entry.transition_date)
          const days = getWorkingDaysCount(entryDate, exitTime)
          totalDays += days
          count++
        }
      }

      if (count > 0) {
        records.push({
          issueKey,
          brand,
          status: display,
          days: totalDays / count,
        })
      }
    }
  }

  return records
}

export async function calculateBackflow(
  tickets: KanbanTicket[],
  transitions: StatusTransition[]
): Promise<BackflowKPIs> {
  const rejections = { Dev: 0, QA: 0, Business: 0 }
  const brandStats: Record<string, any> = {}
  const rejectionsDetail: BackflowKPIs["rejections_detail_by_brand"] = {}

  const targetStatuses = ["done", "ready for release"]
  const targetTickets = tickets.filter((t) => targetStatuses.includes(t.status.toLowerCase()))

  const keys = new Set(targetTickets.map((t) => t.issue_key))
  const filteredTransitions = transitions.filter((t) => keys.has(t.issue_key))

  const grouped = filteredTransitions.reduce(
    (acc, t) => {
      if (!acc[t.issue_key]) acc[t.issue_key] = []
      acc[t.issue_key].push(t)
      return acc
    },
    {} as Record<string, StatusTransition[]>
  )

  let ticketsWithRejectionCount = 0

  for (const [issueKey, group] of Object.entries(grouped)) {
    group.sort((a, b) => new Date(a.transition_date).getTime() - new Date(b.transition_date).getTime())

    const ticket = targetTickets.find((t) => t.issue_key === issueKey)
    const brand = ticket?.brand || "Unknown"
    const points = ticket?.dev_estimation || 0
    const mandays = ticket?.dev_mandays || 0

    if (!brandStats[brand]) {
      brandStats[brand] = {
        total_tickets: 0, rejected_tickets: 0,
        total_points: 0, rejected_points: 0,
        total_mandays: 0, rejected_mandays: 0,
      }
    }
    if (!rejectionsDetail[brand]) rejectionsDetail[brand] = []

    brandStats[brand].total_tickets += 1
    brandStats[brand].total_points += points
    brandStats[brand].total_mandays += mandays

    const getStatusIndex = (status: string) => {
      const s = status.toLowerCase()
      if (["backlog", "to do", "open"].includes(s)) return 0
      if (["in progress", "to fix", "reopened", "refinement"].includes(s)) return 1
      if (["review"].includes(s)) return 2
      if (["it testing", "testing qual-it", "testing qual it"].includes(s)) return 3
      if (["qa testing", "testing qual-bu", "testing qual bu"].includes(s)) return 4
      if (["business testing", "validating on staging"].includes(s)) return 5
      if (["ready for release"].includes(s)) return 6
      if (["done", "canceled", "closed"].includes(s)) return 7
      return -1
    }

    const ticketRejections: {
      status: string
      from_status: string
      transition_date: string
      category: "Dev" | "QA" | "Business"
    }[] = []

    let ticketHasRejection = false

    for (const row of group) {
      const f = row.from_status?.toLowerCase() || ""
      const t = row.to_status?.toLowerCase() || ""

      if (["ready for release", "canceled"].includes(f)) continue
      if (f === t) continue

      const fIndex = getStatusIndex(f)
      const tIndex = getStatusIndex(t)

      let category: "Dev" | "QA" | "Business" | null = null

      if (fIndex !== -1 && tIndex !== -1 && tIndex < fIndex && fIndex >= 2) {
        ticketHasRejection = true
        if (fIndex <= 3) { rejections.Dev += 1; category = "Dev" }
        else if (fIndex === 4) { rejections.QA += 1; category = "QA" }
        else { rejections.Business += 1; category = "Business" }
      }

      if (category && ticket) {
        ticketRejections.push({
          status: row.to_status,
          from_status: row.from_status || "Unknown",
          transition_date: row.transition_date,
          category,
        })
      }
    }

    if (ticketHasRejection) {
      ticketsWithRejectionCount += 1
      brandStats[brand].rejected_tickets += 1
      brandStats[brand].rejected_points += points
      brandStats[brand].rejected_mandays += mandays
    }

    if (ticketRejections.length > 0 && ticket) {
      rejectionsDetail[brand].push({
        issue_key: ticket.issue_key,
        summary: ticket.summary,
        current_status: ticket.status,
        rejections: ticketRejections,
      })
    }
  }

  const totalTickets = targetTickets.length
  let firstTimeRight =
    totalTickets > 0 ? ((totalTickets - ticketsWithRejectionCount) / totalTickets) * 100 : 100.0
  if (firstTimeRight < 0) firstTimeRight = 0

  return {
    first_time_right_pct: firstTimeRight,
    rejections_by_category: rejections,
    rejections_detail_by_brand: rejectionsDetail,
    brands: brandStats,
    total_tickets: totalTickets,
    tickets_with_rejection: ticketsWithRejectionCount,
  }
}

export async function calculatePeriodRejections(
  allTickets: KanbanTicket[],
  periodTransitions: StatusTransition[]
) {
  const rejections = { Dev: 0, QA: 0, Business: 0 }
  const rejectionsDetail: Record<string, any[]> = {}

  const grouped = periodTransitions.reduce(
    (acc, t) => {
      if (!acc[t.issue_key]) acc[t.issue_key] = []
      acc[t.issue_key].push(t)
      return acc
    },
    {} as Record<string, StatusTransition[]>
  )

  for (const [issueKey, group] of Object.entries(grouped)) {
    group.sort((a, b) => new Date(a.transition_date).getTime() - new Date(b.transition_date).getTime())

    const ticket = allTickets.find((t) => t.issue_key === issueKey)
    const brand = ticket?.brand || "Unknown"

    if (!rejectionsDetail[brand]) rejectionsDetail[brand] = []

    const getStatusIndex = (status: string) => {
      const s = status.toLowerCase()
      if (["backlog", "to do", "open"].includes(s)) return 0
      if (["in progress", "to fix", "reopened", "refinement"].includes(s)) return 1
      if (["review"].includes(s)) return 2
      if (["it testing", "testing qual-it", "testing qual it"].includes(s)) return 3
      if (["qa testing", "testing qual-bu", "testing qual bu"].includes(s)) return 4
      if (["business testing", "validating on staging"].includes(s)) return 5
      if (["ready for release"].includes(s)) return 6
      if (["done", "canceled", "closed"].includes(s)) return 7
      return -1
    }

    const ticketRejections: {
      status: string
      from_status: string
      transition_date: string
      category: "Dev" | "QA" | "Business"
    }[] = []

    for (const row of group) {
      const f = row.from_status?.toLowerCase() || ""
      const t = row.to_status?.toLowerCase() || ""

      if (["ready for release", "canceled"].includes(f)) continue
      if (f === t) continue

      const fIndex = getStatusIndex(f)
      const tIndex = getStatusIndex(t)

      let category: "Dev" | "QA" | "Business" | null = null

      if (fIndex !== -1 && tIndex !== -1 && tIndex < fIndex && fIndex >= 2) {
        if (fIndex <= 3) { rejections.Dev += 1; category = "Dev" }
        else if (fIndex === 4) { rejections.QA += 1; category = "QA" }
        else { rejections.Business += 1; category = "Business" }
      }

      if (category && ticket) {
        ticketRejections.push({
          status: row.to_status,
          from_status: row.from_status || "Unknown",
          transition_date: row.transition_date,
          category,
        })
      }
    }

    if (ticketRejections.length > 0 && ticket) {
      rejectionsDetail[brand].push({
        issue_key: ticket.issue_key,
        summary: ticket.summary,
        current_status: ticket.status,
        rejections: ticketRejections,
      })
    }
  }

  return {
    rejections_by_category: rejections,
    rejections_detail_by_brand: rejectionsDetail as BackflowKPIs["rejections_detail_by_brand"],
  }
}

export type RejectionComment = {
  author: string
  created: string
  body: string
}

export async function getRejectionComments(
  issueKey: string,
  transitionDateStr: string
): Promise<RejectionComment[]> {
  return getDataSource().getRejectionComments(issueKey, transitionDateStr)
}

export async function fetchAllTransitions(): Promise<StatusTransition[]> {
  return getDataSource().getTransitions()
}

export async function fetchAllTickets(): Promise<KanbanTicket[]> {
  return getDataSource().getTickets()
}

export interface VelocityData {
  period: string
  [key: string]: number | string
}

export async function calculatePlannedVsActualData(
  tickets: KanbanTicket[],
  fromStr?: string,
  toStr?: string,
  grouping: "week" | "month" | "all" = "all"
): Promise<VelocityData[]> {
  const doneStatuses = ["Done", "Ready for Release", "done", "ready for release"]
  let doneTickets = tickets.filter(
    (t) => doneStatuses.includes(t.status) || doneStatuses.includes(t.status.toLowerCase())
  )

  doneTickets = doneTickets.filter((t) => t.dev_mandays > 0)

  const fromDate = fromStr ? new Date(fromStr).getTime() : null
  const toDate = toStr ? new Date(toStr).getTime() + 86400000 : null

  if (fromDate) {
    doneTickets = doneTickets.filter(
      (t) => t.resolution_date && new Date(t.resolution_date).getTime() >= fromDate
    )
  }
  if (toDate) {
    doneTickets = doneTickets.filter(
      (t) => t.resolution_date && new Date(t.resolution_date).getTime() <= toDate
    )
  }

  const brands = [...new Set(tickets.map((t) => t.brand))].sort()
  const emptyPeriod = () => {
    const seed: Record<string, number> = {}
    for (const brand of brands) {
      seed[`${brand}_planned`] = 0
      seed[`${brand}_actual`] = 0
    }
    return seed
  }

  // Pre-seed all periods in the date range so every brand always has a value
  const groupedData: Record<string, any> = {}

  if (grouping === "week" && fromDate && toDate) {
    // Generate all ISO weeks between fromDate and toDate
    let cursor = new Date(fromDate)
    while (cursor.getTime() <= toDate) {
      const week = getISOWeek(cursor)
      const year = getYear(cursor)
      const key = `W${week.toString().padStart(2, "0")} ${year} `
      if (!groupedData[key]) groupedData[key] = { period: key, ...emptyPeriod() }
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
    }
  } else if (grouping === "month" && fromDate && toDate) {
    // Generate all months between fromDate and toDate
    const start = new Date(fromDate)
    const end = new Date(toDate)
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor.getTime() <= end.getTime()) {
      const key = format(cursor, "MMM yyyy")
      if (!groupedData[key]) groupedData[key] = { period: key, ...emptyPeriod() }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
  }

  for (const ticket of doneTickets) {
    if (!ticket.resolution_date) continue
    const resDate = new Date(ticket.resolution_date)

    let periodKey = "Période Globale"

    if (grouping === "week") {
      const week = getISOWeek(resDate)
      const year = getYear(resDate)
      periodKey = `W${week.toString().padStart(2, "0")} ${year} `
    } else if (grouping === "month") {
      periodKey = format(resDate, "MMM yyyy")
    }

    if (!groupedData[periodKey]) {
      groupedData[periodKey] = { period: periodKey, ...emptyPeriod() }
    }

    const brand = ticket.brand
    groupedData[periodKey][`${brand}_planned`] = (groupedData[periodKey][`${brand}_planned`] || 0) + (ticket.dev_estimation || 0)
    groupedData[periodKey][`${brand}_actual`] = (groupedData[periodKey][`${brand}_actual`] || 0) + (ticket.dev_mandays || 0)
  }

  const result = Object.values(groupedData)

  if (grouping !== "all") {
    result.sort((a, b) => {
      if (grouping === "week") {
        const mA = a.period.match(/W(\d+) (\d+)/)
        const mB = b.period.match(/W(\d+) (\d+)/)
        if (!mA || !mB) return 0
        if (mA[2] !== mB[2]) return Number(mA[2]) - Number(mB[2])
        return Number(mA[1]) - Number(mB[1])
      } else if (grouping === "month") {
        return new Date(a.period).getTime() - new Date(b.period).getTime()
      }
      return 0
    })
  }

  return result.map((item) => {
    const p: any = { period: item.period }
    for (const [key, value] of Object.entries(item)) {
      if (key !== "period" && typeof value === "number") {
        p[key] = Number((value as number).toFixed(1))
      }
    }
    return p as VelocityData
  })
}

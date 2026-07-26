"use server"

import { getDataSource } from "../data-source"
import { addDays, endOfMonth, format, getISOWeek, parseISO } from "date-fns"
import type { BilledDayEntry, PlannedRate, BudgetChartPoint, DateRange } from "../../types/financial"
import { getWorkingDaysInRange } from "../financial/working-days"
import { deriveMonthlyFromWeekly } from "../financial/derive-monthly"

export type { BilledDayEntry, PlannedRate, BudgetChartPoint, DateRange } from "../../types/financial"

// -------------------------------------------------------------------
// Data Fetching
// -------------------------------------------------------------------
export async function fetchBilledDays(
    periodType: "week" | "month",
    dateRange?: DateRange
): Promise<BilledDayEntry[]> {
    return getDataSource().getBilledDays(periodType, dateRange)
}

export async function fetchPlannedRates(): Promise<PlannedRate[]> {
    return getDataSource().getPlannedRates()
}

// -------------------------------------------------------------------
// Monthly data with weekly fallback
// -------------------------------------------------------------------

// Monthly entries are authoritative when present; when a live user only fills
// in the weekly grid, monthly figures are derived from it (boundary weeks are
// split pro-rata on working days) so cards and the monthly chart stay populated.
async function fetchMonthlyBilledWithFallback(dateRange?: DateRange): Promise<BilledDayEntry[]> {
    const monthly = await fetchBilledDays("month", dateRange)
    if (monthly.length > 0) return monthly
    const weekly = await fetchBilledDays("week", dateRange)
    if (weekly.length === 0) return monthly
    return deriveMonthlyFromWeekly(weekly)
}

// -------------------------------------------------------------------
// Planned lookup — returns daily_rate as-is, no calculation
// -------------------------------------------------------------------
function getPlannedForRange(
    brand: string,
    startStr: string,
    endStr: string,
    plannedRates: PlannedRate[]
): number {
    const rate = plannedRates.find(r =>
        r.brand === brand &&
        r.effective_from <= startStr &&
        (!r.effective_to || r.effective_to >= endStr)
    )
    return rate ? rate.daily_rate : 0
}

// Prorate a monthly budget across a week: budget_month × (wd_week / wd_month)
// This avoids multi-counting when a monthly rate is looked up for each week.
function getPlannedProrated(
    brand: string,
    weekStartStr: string,
    weekEndStr: string,
    plannedRates: PlannedRate[]
): number {
    const monthStart = weekStartStr.slice(0, 7) + "-01"
    const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd')
    const monthlyBudget = getPlannedForRange(brand, monthStart, monthEnd, plannedRates)
    if (monthlyBudget === 0) return 0
    const wdMonth = getWorkingDaysInRange(monthStart, monthEnd)
    const wdWeek = getWorkingDaysInRange(weekStartStr, weekEndStr)
    return wdMonth > 0 ? monthlyBudget * wdWeek / wdMonth : 0
}

// -------------------------------------------------------------------
// Budget Evolution Calculation
// -------------------------------------------------------------------
export async function calculateBudgetEvolution(
    periodType: "week" | "month",
    dateRange?: DateRange,
    showForecast?: boolean
): Promise<BudgetChartPoint[]> {
    const billedData = periodType === "month"
        ? await fetchMonthlyBilledWithFallback(dateRange)
        : await fetchBilledDays(periodType, dateRange)
    const plannedRates = await fetchPlannedRates()

    if (billedData.length === 0) return []

    // Brands with either billed entries or planned rates (a brand without rates simply gets 0 planned)
    const brands = [...new Set([
        ...billedData.map((e) => e.brand),
        ...plannedRates.map((r) => r.brand),
    ])]

    // Group billed data by period
    const periodMap: Record<string, {
        order: number
        label: string
        startDate: string
        endDate: string
        billed: Record<string, number>
    }> = {}

    for (const entry of billedData) {
        const key = entry.period_label
        if (!periodMap[key]) {
            const order = periodType === "month"
                ? entry.month_number
                : (entry.month_number - 1) * 10 + (entry.week_number || 0)
            periodMap[key] = {
                order,
                label: key,
                startDate: entry.start_date,
                endDate: entry.end_date,
                billed: {}
            }
        }
        periodMap[key].billed[entry.brand] = entry.billed_days
    }

    const sortedPeriods = Object.values(periodMap).sort((a, b) => a.order - b.order)

    const result: BudgetChartPoint[] = []
    const cumulBilled: Record<string, number> = {}
    const cumulPlanned: Record<string, number> = {}

    for (const brand of brands) {
        cumulBilled[brand] = 0
        cumulPlanned[brand] = 0
    }

    for (const period of sortedPeriods) {
        let totalBilled = 0
        let totalPlanned = 0

        // For weeks: clamp to dateRange boundaries for prorata (cross-month boundary weeks)
        const effectiveStart = periodType === "week" && dateRange?.from && dateRange.from > period.startDate
            ? dateRange.from : period.startDate
        const effectiveEnd = periodType === "week" && dateRange?.to && dateRange.to < period.endDate
            ? dateRange.to : period.endDate

        const point: BudgetChartPoint = {
            period: period.label,
            order: period.order,
            period_start: effectiveStart,
            period_end: effectiveEnd,
        }
        const totalWD = periodType === "week" ? getWorkingDaysInRange(period.startDate, period.endDate) : 1
        const effectiveWD = periodType === "week" ? getWorkingDaysInRange(effectiveStart, effectiveEnd) : 1
        const billedRatio = totalWD > 0 ? effectiveWD / totalWD : 1

        // Skip weeks with no working days in the effective range
        // (e.g. W09 Feb23-Mar01 when from=Mar01 Sunday → effectiveWD=0)
        if (periodType === "week" && effectiveWD === 0) continue

        for (const brand of brands) {
            let billedThisPeriod: number
            let plannedThisPeriod: number

            if (periodType === "week") {
                billedThisPeriod = (period.billed[brand] || 0) * billedRatio
                plannedThisPeriod = getPlannedProrated(brand, effectiveStart, effectiveEnd, plannedRates)
            } else {
                billedThisPeriod = period.billed[brand] || 0
                plannedThisPeriod = getPlannedForRange(brand, period.startDate, period.endDate, plannedRates)
            }

            cumulBilled[brand] += billedThisPeriod
            point[`${brand}_billed`] = Number(cumulBilled[brand].toFixed(1))

            cumulPlanned[brand] += plannedThisPeriod
            point[`${brand}_planned`] = Number(cumulPlanned[brand].toFixed(1))

            totalBilled += cumulBilled[brand]
            totalPlanned += cumulPlanned[brand]
        }

        point["Total_billed"] = Number(totalBilled.toFixed(1))
        point["Total_planned"] = Number(totalPlanned.toFixed(1))

        result.push(point)
    }

    // Forecast: extend planned (dashed) lines into remaining weeks of the selected period
    if (showForecast && periodType === "week" && dateRange?.to && sortedPeriods.length > 0) {
        const lastEndDate = sortedPeriods[sortedPeriods.length - 1].endDate
        const toDate = parseISO(dateRange.to)
        let cursor = addDays(parseISO(lastEndDate), 1)

        while (cursor <= toDate) {
            const weekEnd = addDays(cursor, 6) <= toDate ? addDays(cursor, 6) : toDate
            const weekStartStr = cursor.toISOString().split("T")[0]
            const weekEndStr = weekEnd.toISOString().split("T")[0]

            const isoWeek = getISOWeek(cursor)
            const monthNumber = cursor.getMonth() + 1
            const order = (monthNumber - 1) * 10 + isoWeek
            const label = `S${String(isoWeek).padStart(2, '0')} ${cursor.getFullYear()}`

            const point: BudgetChartPoint = {
                period: label,
                order,
                period_start: weekStartStr,
                period_end: weekEndStr,
            }

            let totalPlanned = 0

            for (const brand of brands) {
                cumulPlanned[brand] += getPlannedProrated(brand, weekStartStr, weekEndStr, plannedRates)
                point[`${brand}_planned`] = Number(cumulPlanned[brand].toFixed(1))
                totalPlanned += cumulPlanned[brand]
            }

            point["Total_planned"] = Number(totalPlanned.toFixed(1))

            result.push(point)
            cursor = addDays(weekEnd, 1)
        }
    }

    return result
}

// -------------------------------------------------------------------
// Metric Cards
// -------------------------------------------------------------------
async function calculateMetricsForPeriod(
    periodType: "week" | "month",
    dateRange?: DateRange
) {
    // Always use monthly billed data for summary metrics: monthly entries are the authoritative
    // source and avoid boundary-week partial-counting issues that affect weekly totals.
    // Falls back to weekly-derived data when no monthly entry exists.
    const billedData = await fetchMonthlyBilledWithFallback(dateRange)
    const plannedRates = await fetchPlannedRates()

    let totalBilled = 0
    for (const entry of billedData) {
        totalBilled += entry.billed_days
    }

    let totalPlanned = 0
    const periodsProcessed = new Set<string>()
    for (const entry of billedData) {
        const key = `${entry.period_label}_${entry.brand}`
        if (periodsProcessed.has(key)) continue
        periodsProcessed.add(key)

        totalPlanned += getPlannedForRange(entry.brand, entry.start_date, entry.end_date, plannedRates)
    }

    const ecartPct = totalPlanned > 0
        ? ((totalBilled - totalPlanned) / totalPlanned * 100)
        : 0

    return {
        totalBilled: Number(totalBilled.toFixed(1)),
        totalPlanned: Number(totalPlanned.toFixed(1)),
        ecartPct: Number(ecartPct.toFixed(1)),
        burnRate: totalPlanned > 0
            ? Number((totalBilled / totalPlanned * 100).toFixed(0))
            : 0
    }
}

export async function calculateBudgetMetrics(
    periodType: "week" | "month",
    dateRange?: DateRange
) {
    const current = await calculateMetricsForPeriod(periodType, dateRange)

    let past = null
    if (dateRange?.from && dateRange?.to) {
        const fromMs = new Date(dateRange.from).getTime()
        const toMs = new Date(dateRange.to).getTime()
        const durationMs = toMs - fromMs
        const pastFrom = new Date(fromMs - durationMs - 86400000).toISOString().split('T')[0]
        const pastTo = new Date(fromMs - 86400000).toISOString().split('T')[0]
        past = await calculateMetricsForPeriod(periodType, { from: pastFrom, to: pastTo })
    }

    return {
        current,
        past
    }
}

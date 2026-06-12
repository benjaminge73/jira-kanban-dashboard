import { VelocityChart } from "@/components/dashboard/velocity-chart"
import { VelocityGroupingSelector } from "@/components/dashboard/velocity-grouping-selector"
import { TimeStatusChart } from "@/components/dashboard/time-status-chart"
import { TrendMetricCard } from "@/components/dashboard/trend-metric-card"
import { AgingWipChart } from "@/components/dashboard/aging-wip-chart"
import { ThroughputChart } from "@/components/dashboard/throughput-chart"
import { ForecastTable } from "@/components/dashboard/forecast-table"
import { fetchAllTickets, fetchAllTransitions, calculateTimeSpentPerStatus, calculatePlannedVsActualData } from "@/lib/actions/kpis"
import { getUiMeta } from "@/lib/actions/meta"
import { isDoneStatus } from "@/lib/flow/statuses"
import {
    computeAgingWip,
    computeCycleTimes,
    computeWeeklyThroughput,
    cycleTimeStats,
    monteCarloForecast,
    throughputHistory,
} from "@/lib/flow/metrics"
import { PageHeader, TranslatedText } from "@/components/layout/page-header"

export const revalidate = 0 // Disable cache for dashboard

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams;
    const fromStr = typeof params.from === 'string' ? params.from : undefined;
    const toStr = typeof params.to === 'string' ? params.to : undefined;
    const grouping = (typeof params.grouping === 'string' ? params.grouping : 'all') as 'week' | 'month' | 'all';

    const meta = await getUiMeta()
    const brands = meta.brands
    const tickets = await fetchAllTickets()
    const transitions = await fetchAllTransitions()

    // Filter tickets by period for metrics
    let periodTickets = tickets
    if (fromStr) {
        const fromDate = new Date(fromStr).getTime()
        periodTickets = periodTickets.filter(t => t.resolution_date && new Date(t.resolution_date).getTime() >= fromDate)
    }
    if (toStr) {
        const toDate = new Date(toStr).getTime() + 86400000
        periodTickets = periodTickets.filter(t => t.resolution_date && new Date(t.resolution_date).getTime() <= toDate)
    }

    const periodDoneTickets = periodTickets.filter(t => isDoneStatus(t.status))
    const totalTickets = periodDoneTickets.length
    const totalStoryPoints = periodDoneTickets.reduce((acc, t) => acc + (t.dev_estimation || 0), 0)

    // Cycle time (work start → delivery, working days) for the selected period
    const cycleEntries = computeCycleTimes(tickets, transitions, { from: fromStr, to: toStr })
    const cycle = cycleTimeStats(cycleEntries)

    // Aging WIP: current in-progress tickets vs all-time cycle time percentiles
    const now = new Date()
    const aging = computeAgingWip(tickets, transitions, now)
    const historicalCycle = (fromStr || toStr)
        ? cycleTimeStats(computeCycleTimes(tickets, transitions))
        : cycle

    // Throughput run chart + Monte Carlo forecast (history of completed weeks)
    const throughputData = computeWeeklyThroughput(tickets, brands, { from: fromStr, to: toStr })
    const history = throughputHistory(tickets, now)
    const forecastRows = history.length >= 4 ? monteCarloForecast(history, [2, 4, 8]) : []

    // 2. Prepare Chart Data
    // Time Status Data
    const rawTimeStatusData = await calculateTimeSpentPerStatus(tickets, transitions, fromStr, toStr)

    const pivotTimeStatusData: any[] = []
    const statusGroups = rawTimeStatusData.reduce((acc: any, row) => {
        if (!acc[row.status]) {
            acc[row.status] = { status: row.status, sums: {}, counts: {}, totalDays: 0, totalCount: 0 }
        }

        if (brands.includes(row.brand)) {
            const g = acc[row.status]
            g.sums[row.brand] = (g.sums[row.brand] || 0) + row.days
            g.counts[row.brand] = (g.counts[row.brand] || 0) + 1
            g.totalDays += row.days
            g.totalCount += 1
        }

        return acc
    }, {})

    for (const key of Object.keys(statusGroups)) {
        const g = statusGroups[key]
        const point: any = {
            status: key,
            Moyenne: g.totalCount > 0 ? Number((g.totalDays / g.totalCount).toFixed(1)) : null,
        }
        for (const brand of brands) {
            point[brand] = g.counts[brand] > 0 ? Number((g.sums[brand] / g.counts[brand]).toFixed(1)) : null
        }
        pivotTimeStatusData.push(point)
    }

    const statusOrder = ["Review", "IT Testing", "QA Testing", "Business Testing", "Ready For Release", "Done"]
    pivotTimeStatusData.sort((a, b) => {
        let ia = statusOrder.indexOf(a.status)
        let ib = statusOrder.indexOf(b.status)
        if (ia === -1) ia = 99
        if (ib === -1) ib = 99
        return ia - ib
    })

    // Planned vs Actual Chart Data — hidden when the data source has no trusted man-days source
    const showPlannedVsActual = meta.showPlannedVsActual
    const chartData = showPlannedVsActual
        ? await calculatePlannedVsActualData(tickets, fromStr, toStr, grouping)
        : [];

    // Réel / Prévu as percentage from chart data
    let totalPlanned = 0, totalActual = 0
    for (const point of chartData) {
        for (const brand of brands) {
            totalPlanned += (point[`${brand}_planned`] as number) || 0
            totalActual += (point[`${brand}_actual`] as number) || 0
        }
    }
    const reelPrevuPct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : null

    // Past period comparison: compute the equivalent past period
    let pastTotalTickets: number | null = null
    let pastCycleP50: number | null = null
    let pastTotalStoryPoints: number | null = null
    let pastReelPrevuPct: number | null = null

    // Variants for cards based on trend
    let ticketsVariant: "default" | "success" | "danger" = "default"
    let cycleVariant: "default" | "success" | "danger" = "default"
    let spVariant: "default" | "success" | "danger" = "default"

    if (fromStr && toStr) {
        const fromMs = new Date(fromStr).getTime()
        const toMs = new Date(toStr).getTime()
        const durationMs = toMs - fromMs
        const pastFrom = new Date(fromMs - durationMs - 86400000).toISOString().split('T')[0]
        const pastTo = new Date(fromMs - 86400000).toISOString().split('T')[0]

        // Past tickets + story points
        const pastFromMs = new Date(pastFrom).getTime()
        const pastToMs = new Date(pastTo).getTime() + 86400000
        const pastPeriodDoneTickets = tickets.filter(t =>
            t.resolution_date &&
            new Date(t.resolution_date).getTime() >= pastFromMs &&
            new Date(t.resolution_date).getTime() <= pastToMs &&
            isDoneStatus(t.status)
        )
        pastTotalTickets = pastPeriodDoneTickets.length
        pastTotalStoryPoints = pastPeriodDoneTickets.reduce((acc, t) => acc + (t.dev_estimation || 0), 0)

        // Past cycle time
        const pastCycle = cycleTimeStats(computeCycleTimes(tickets, transitions, { from: pastFrom, to: pastTo }))
        pastCycleP50 = pastCycle.p50

        // Past réel/prévu
        if (showPlannedVsActual) {
            const pastChartData = await calculatePlannedVsActualData(tickets, pastFrom, pastTo, grouping)
            let pastPlanned = 0, pastActual = 0
            for (const point of pastChartData) {
                for (const brand of brands) {
                    pastPlanned += (point[`${brand}_planned`] as number) || 0
                    pastActual += (point[`${brand}_actual`] as number) || 0
                }
            }
            pastReelPrevuPct = pastPlanned > 0 ? (pastActual / pastPlanned) * 100 : null
        }

        // Calculate variants based on trends
        if (pastTotalTickets !== null) {
            const ticketsDelta = totalTickets - pastTotalTickets
            ticketsVariant = ticketsDelta > 0.5 ? "success" : ticketsDelta < -0.5 ? "danger" : "default"
        }

        if (cycle.p50 !== null && pastCycleP50 !== null) {
            const cycleDelta = cycle.p50 - pastCycleP50
            // Lower is better for cycle time
            cycleVariant = cycleDelta < -0.5 ? "success" : cycleDelta > 0.5 ? "danger" : "default"
        }

        if (pastTotalStoryPoints !== null) {
            const spDelta = totalStoryPoints - pastTotalStoryPoints
            spVariant = spDelta > 0.5 ? "success" : spDelta < -0.5 ? "danger" : "default"
        }
    }

    const liveDataBadge = (
        <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <TranslatedText k={meta.mode === "live" ? "dashboard.liveData" : "dashboard.demoData"} />
        </span>
    )

    return (
        <div className="p-8 space-y-8">
            <PageHeader titleKey="dashboard.title" subtitleKey="dashboard.subtitle" />

            <div className={`grid gap-6 md:grid-cols-2 ${showPlannedVsActual ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4"}`}>
                <TrendMetricCard
                    titleKey="dashboard.completedTickets"
                    value={totalTickets.toString()}
                    pastValue={pastTotalTickets !== null ? pastTotalTickets.toString() : null}
                    higherIsBetter={true}
                    variant={ticketsVariant}
                />
                <TrendMetricCard
                    titleKey="dashboard.cycleTime"
                    value={cycle.p50 !== null ? `${cycle.p50} j` : "N/A"}
                    subtitle={cycle.p85 !== null ? `P85 : ${cycle.p85} j` : undefined}
                    pastValue={pastCycleP50 !== null ? pastCycleP50.toString() : null}
                    tooltip={<TranslatedText k="dashboard.cycleTimeTooltip" />}
                    higherIsBetter={false}
                    variant={cycleVariant}
                />
                <TrendMetricCard
                    titleKey="dashboard.wip"
                    value={aging.wipCount.toString()}
                    tooltip={<TranslatedText k="dashboard.wipTooltip" />}
                    higherIsBetter={false}
                />
                <TrendMetricCard
                    titleKey="dashboard.storyPoints"
                    value={`${parseFloat(totalStoryPoints.toFixed(1))} SP`}
                    pastValue={pastTotalStoryPoints !== null ? parseFloat(pastTotalStoryPoints.toFixed(1)).toString() : null}
                    higherIsBetter={true}
                    variant={spVariant}
                />
                {showPlannedVsActual && (
                    <TrendMetricCard
                        titleKey="dashboard.actualVsPlanned"
                        value={reelPrevuPct !== null ? `${reelPrevuPct.toFixed(0)}%` : "N/A"}
                        currentPct={reelPrevuPct}
                        pastPct={pastReelPrevuPct}
                        higherIsBetter={false}
                        isColoredCard={true}
                    />
                )}
            </div>

            <div className="mt-8 grid gap-8">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col">
                    <div className="p-6 border-b border-border/50 bg-muted/20">
                        <div className="flex w-full justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold"><TranslatedText k="dashboard.timePerStatus" /></h3>
                                <p className="text-sm text-muted-foreground mt-1"><TranslatedText k="dashboard.timePerStatusDesc" /></p>
                            </div>
                            {liveDataBadge}
                        </div>

                        <div className="mt-4 bg-background/50 rounded-lg p-3 text-sm text-muted-foreground border border-border/50">
                            <details className="group cursor-pointer">
                                <summary className="font-medium text-foreground flex items-center justify-between outline-none">
                                    <span>💡 <TranslatedText k="dashboard.howToRead" /></span>
                                    <span className="transition group-open:rotate-180">↓</span>
                                </summary>
                                <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/50 text-sm">
                                    <p><TranslatedText k="dashboard.howToReadBody1" /></p>
                                    <p><TranslatedText k="dashboard.howToReadBody3" /></p>
                                    <p className="text-muted-foreground/70 text-xs"><TranslatedText k="dashboard.howToReadBody2" /></p>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div className="h-[450px] w-full p-6">
                        {pivotTimeStatusData.length > 0 ? (
                            <TimeStatusChart data={pivotTimeStatusData} brands={brands} brandColors={meta.brandColors} />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                                <TranslatedText k="dashboard.noTransitionData" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col">
                    <div className="p-6 border-b border-border/50 bg-muted/20">
                        <div className="flex w-full justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold"><TranslatedText k="dashboard.agingWip" /></h3>
                                <p className="text-sm text-muted-foreground mt-1"><TranslatedText k="dashboard.agingWipDesc" /></p>
                            </div>
                            {liveDataBadge}
                        </div>

                        <div className="mt-4 bg-background/50 rounded-lg p-3 text-sm text-muted-foreground border border-border/50">
                            <details className="group cursor-pointer">
                                <summary className="font-medium text-foreground flex items-center justify-between outline-none">
                                    <span className="flex items-center gap-2">💡 <TranslatedText k="dashboard.howToRead" /></span>
                                    <span className="transition group-open:rotate-180">↓</span>
                                </summary>
                                <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/50 text-sm">
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><TranslatedText k="dashboard.agingDots" /></li>
                                        <li><TranslatedText k="dashboard.agingBands" /></li>
                                        <li><TranslatedText k="dashboard.agingAction" /></li>
                                    </ul>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div className="h-[450px] w-full p-6">
                        {aging.items.length > 0 ? (
                            <AgingWipChart
                                items={aging.items}
                                p50={historicalCycle.p50}
                                p85={historicalCycle.p85}
                                brands={brands}
                                brandColors={meta.brandColors}
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                                <TranslatedText k="dashboard.noWip" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col">
                    <div className="p-6 border-b border-border/50 bg-muted/20">
                        <div className="flex w-full justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold"><TranslatedText k="dashboard.throughputTitle" /></h3>
                                <p className="text-sm text-muted-foreground mt-1"><TranslatedText k="dashboard.throughputDesc" /></p>
                            </div>
                            {liveDataBadge}
                        </div>
                    </div>

                    <div className="h-[400px] w-full p-6">
                        {throughputData.length > 0 ? (
                            <ThroughputChart data={throughputData} brands={brands} brandColors={meta.brandColors} />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                                <TranslatedText k="dashboard.noData" />
                            </div>
                        )}
                    </div>

                    <div className="px-6 pb-6">
                        <div className="border-t border-border/50 pt-5">
                            <ForecastTable rows={forecastRows} historyWeeks={history.length} />
                        </div>
                    </div>
                </div>

                {showPlannedVsActual && (
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col">
                        <div className="p-6 border-b border-border/50 bg-muted/20">
                            <div className="flex w-full justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold"><TranslatedText k="dashboard.plannedVsActual" /></h3>
                                    <p className="text-sm text-muted-foreground mt-1"><TranslatedText k="dashboard.plannedVsActualDesc" /></p>
                                </div>
                                {liveDataBadge}
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <VelocityGroupingSelector currentGrouping={grouping} />
                            </div>

                            <div className="mt-4 bg-background/50 rounded-lg p-3 text-sm text-muted-foreground border border-border/50">
                                <details className="group cursor-pointer">
                                    <summary className="font-medium text-foreground flex items-center justify-between outline-none">
                                        <span className="flex items-center gap-2">💡 <TranslatedText k="dashboard.howToRead" /></span>
                                        <span className="transition group-open:rotate-180">↓</span>
                                    </summary>
                                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/50 text-sm">
                                        <p className="mb-2 text-foreground"><TranslatedText k="dashboard.howToReadPva1" /></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><TranslatedText k="dashboard.hatchedBars" /></li>
                                            <li><TranslatedText k="dashboard.solidBars" /></li>
                                            <li><TranslatedText k="dashboard.exclusion" /></li>
                                        </ul>
                                    </div>
                                </details>
                            </div>
                        </div>

                        <div className="h-[450px] w-full p-6">
                            {chartData.length > 0 ? (
                                <VelocityChart data={chartData} brands={brands} brandColors={meta.brandColors} />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                                    <TranslatedText k="dashboard.noData" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

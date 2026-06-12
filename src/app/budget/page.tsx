import { Suspense } from "react"
import { redirect } from "next/navigation"
import { BudgetChart } from "@/components/dashboard/budget-chart"
import { BudgetForecastToggle } from "@/components/dashboard/budget-forecast-toggle"
import { BudgetGroupingSelector } from "@/components/dashboard/budget-grouping-selector"
import { TrendMetricCard } from "@/components/dashboard/trend-metric-card"
import { calculateBudgetEvolution, calculateBudgetMetrics } from "@/lib/actions/budget"
import { getUiMeta } from "@/lib/actions/meta"
import { getAppSettings } from "@/lib/actions/settings"
import { PageHeader, TranslatedText } from "@/components/layout/page-header"

export const revalidate = 0

export default async function BudgetPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { showBudgetTab } = await getAppSettings()
    if (!showBudgetTab) redirect("/dashboard")

    const params = await searchParams
    const view = (typeof params.view === "string" ? params.view : "week") as "week" | "month"
    const from = typeof params.from === "string" ? params.from : undefined
    const to = typeof params.to === "string" ? params.to : undefined
    const forecast = params.forecast === "true"

    const dateRange = from || to ? { from, to } : undefined

    const meta = await getUiMeta()
    const chartData = await calculateBudgetEvolution(view, dateRange, forecast)
    const metricsResult = await calculateBudgetMetrics(view, dateRange)
    const metrics = metricsResult.current
    const pastMetrics = metricsResult.past

    const ecartVariant = metrics.ecartPct > 10 ? "danger" : metrics.ecartPct > 0 ? "warning" : "success"
    const burnVariant = metrics.burnRate > 100 ? "danger" : metrics.burnRate > 80 ? "warning" : "success"

    return (
        <div className="p-8 space-y-8">
            <PageHeader titleKey="budget.title" subtitleKey="budget.subtitle" />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <TrendMetricCard
                    titleKey="budget.totalBilled"
                    value={`${metrics.totalBilled} JH`}
                    pastValue={pastMetrics ? `${pastMetrics.totalBilled}` : null}
                    higherIsBetter={false}
                />
                <TrendMetricCard
                    titleKey="budget.totalPlanned"
                    value={`${metrics.totalPlanned} JH`}
                    pastValue={pastMetrics ? `${pastMetrics.totalPlanned}` : null}
                    higherIsBetter={false}
                />
                <TrendMetricCard
                    titleKey="budget.gap"
                    value={`${metrics.ecartPct > 0 ? "+" : ""}${metrics.ecartPct}%`}
                    pastValue={pastMetrics ? `${pastMetrics.ecartPct}` : null}
                    higherIsBetter={false}
                    variant={ecartVariant}
                />
                <TrendMetricCard
                    titleKey="budget.burnRate"
                    value={`${metrics.burnRate}%`}
                    pastValue={pastMetrics ? `${pastMetrics.burnRate}` : null}
                    higherIsBetter={false}
                    variant={burnVariant}
                />
            </div>

            <div className="mt-8 grid gap-8">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col">
                    <div className="p-6 border-b border-border/50 bg-muted/20">
                        <div className="flex w-full justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold">
                                    <TranslatedText k="budget.chartTitle" />
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    <TranslatedText k="budget.chartDesc" />
                                </p>
                            </div>
                            <span className="text-xs font-medium text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                <TranslatedText k="budget.manualData" />
                            </span>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                            <Suspense fallback={<div className="h-8 w-32 animate-pulse bg-muted rounded-lg" />}>
                                <BudgetGroupingSelector currentGrouping={view} />
                            </Suspense>
                            {view === "week" && (
                                <Suspense fallback={<div className="h-6 w-40 animate-pulse bg-muted rounded-full" />}>
                                    <BudgetForecastToggle currentForecast={forecast} />
                                </Suspense>
                            )}
                        </div>

                        <div className="mt-4 bg-background/50 rounded-lg p-3 text-sm text-muted-foreground border border-border/50">
                            <details className="group cursor-pointer">
                                <summary className="font-medium text-foreground flex items-center justify-between outline-none">
                                    <span className="flex items-center gap-2">💡 <TranslatedText k="budget.howToRead" /></span>
                                    <span className="transition group-open:rotate-180">↓</span>
                                </summary>
                                <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/50 text-sm">
                                    <p className="mb-2 text-foreground"><TranslatedText k="budget.howToReadBody" /></p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><TranslatedText k="budget.solidLines" /></li>
                                        <li><TranslatedText k="budget.dashedLines" /></li>
                                        <li><TranslatedText k="budget.orangeLine" /></li>
                                    </ul>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div className="w-full p-6">
                        {chartData.length > 0 ? (
                            <div className="h-[450px]">
                                <BudgetChart data={chartData} view={view} brands={meta.brands} brandColors={meta.brandColors} />
                            </div>
                        ) : (
                            <div className="h-[300px] w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                                <div className="text-center space-y-2">
                                    <p className="text-lg font-medium"><TranslatedText k="budget.noData" /></p>
                                    <p className="text-sm text-muted-foreground"><TranslatedText k="budget.noDataDesc" /></p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

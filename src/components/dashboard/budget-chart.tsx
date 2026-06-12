"use client"

import {
    LineChart, Line, CartesianGrid, XAxis, YAxis,
    Tooltip, ResponsiveContainer
} from "recharts"
import { BudgetChartPoint } from "@/lib/actions/budget"
import { useState, useRef, useEffect } from "react"
import { format, parseISO } from "date-fns"
import { useLanguage } from "@/lib/i18n/context"

// Resolves a brand color as a CSS variable (overridable in globals.css) with a
// hex fallback supplied by the data source.
function brandCssColor(brand: string, brandColors: Record<string, string>): string {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "")
    return `var(--brand-${slug}, ${brandColors[brand] || "#999"})`
}

interface BrandSeries {
    key: string
    label: string
    color: string
}

const totalColor = "#f97316"

// Extract "S09" from various label formats (S09 2026 / W09 2026 / Semaine 9)
function extractWeekShortLabel(raw: string): string {
    let m = raw.match(/^(S\d+)/)
    if (m) return m[1]
    m = raw.match(/^W(\d+)/)
    if (m) return `S${m[1].padStart(2, '0')}`
    m = raw.match(/Semaine\s+(\d+)/i)
    if (m) return `S${m[1].padStart(2, '0')}`
    return raw
}

// Custom XAxis tick — "S09" at 12px + "24/02-02/03" at 10px (hidden if tight)
function WeekTick({ x, y, payload, chartData, showDates }: {
    x?: number; y?: number; payload?: { value: string }; chartData: BudgetChartPoint[]; showDates: boolean
}) {
    const raw = payload?.value ?? ""
    const point = chartData.find(p => p.period === raw)
    const shortLabel = extractWeekShortLabel(raw)

    let dateStr = ""
    if (showDates && point?.period_start && point?.period_end) {
        try {
            const start = parseISO(point.period_start as string)
            const end = parseISO(point.period_end as string)
            dateStr = `${format(start, 'dd/MM')}-${format(end, 'dd/MM')}`
        } catch (_) { /* ignore */ }
    }

    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            <text
                x={0} y={0} dy={14}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize={12}
                fontWeight={700}
            >
                {shortLabel}
            </text>
            {dateStr && (
                <text
                    x={0} y={0} dy={27}
                    textAnchor="middle"
                    fill="var(--muted-foreground)"
                    fontSize={10}
                    opacity={0.9}
                >
                    {dateStr}
                </text>
            )}
        </g>
    )
}

function MonthTick({ x, y, payload }: {
    x?: number; y?: number; payload?: { value: string }
}) {
    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            <text
                x={0} y={0} dy={15}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize={12}
                fontWeight={600}
            >
                {payload?.value ?? ""}
            </text>
        </g>
    )
}

function CustomTooltip({ active, payload, label, billedLabel, plannedLabel, brandSeries }: any) {
    if (!active || !payload || payload.length === 0) return null

    const grouped: Record<string, { billed?: number; planned?: number }> = {}
    for (const entry of payload) {
        const [brand, type] = entry.dataKey.split("_")
        if (!grouped[brand]) grouped[brand] = {}
        if (type === "billed") grouped[brand].billed = entry.value
        if (type === "planned") grouped[brand].planned = entry.value
    }

    const brandOrder = [...(brandSeries as BrandSeries[]).map(b => b.key), "Total"]
    const colorMap: Record<string, string> = Object.fromEntries(
        (brandSeries as BrandSeries[]).map(b => [b.key, b.color])
    )
    colorMap.Total = totalColor

    return (
        <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-lg shadow-2xl min-w-[200px] text-xs">
            <p className="text-xs font-bold text-foreground mb-2 border-b border-border/50 pb-1.5">{label}</p>
            <div className="space-y-1.5">
                {brandOrder.filter(b => grouped[b]).map((brand) => {
                    const g = grouped[brand]
                    const dotColor = colorMap[brand] || "#999"
                    return (
                        <div key={brand}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: dotColor }} />
                                <span className="text-xs font-bold tracking-wider uppercase text-foreground">{brand}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0 pl-4">
                                {g.billed !== undefined && (
                                    <>
                                        <span className="text-xs text-muted-foreground font-semibold">{billedLabel}</span>
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-sm font-bold font-mono text-foreground">{g.billed}</span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">WD</span>
                                        </div>
                                    </>
                                )}
                                {g.planned !== undefined && (
                                    <>
                                        <span className="text-xs text-muted-foreground font-semibold">{plannedLabel}</span>
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-sm font-bold font-mono text-foreground">{g.planned}</span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">WD</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function CustomLegend({ hiddenSeries, toggleSeries, billedLabel, plannedLabel, brandSeries }: {
    hiddenSeries: Record<string, boolean>
    toggleSeries: (brand: string) => void
    billedLabel: string
    plannedLabel: string
    brandSeries: BrandSeries[]
}) {
    const items = [
        ...brandSeries.map(b => ({ name: b.label, color: b.color, key: b.key })),
        { name: "Total", color: totalColor, key: "Total" },
    ]

    return (
        <div className="flex flex-wrap justify-center gap-8 pt-8 mt-6 border-t border-border/30">
            {items.map((item) => {
                const isHidden = hiddenSeries[item.key]
                return (
                    <div
                        key={item.name}
                        className={`flex items-center gap-5 cursor-pointer transition-all duration-300 hover:scale-105 ${isHidden ? "opacity-30 grayscale" : "opacity-100"}`}
                        onClick={() => toggleSeries(item.key)}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3.5 h-3.5 rounded-full shadow-inner border border-white/20 flex items-center justify-center"
                                style={{ backgroundColor: isHidden ? "transparent" : item.color }}
                            >
                                {!isHidden && <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
                            </div>
                            <span
                                className="text-[10px] font-bold tracking-wider uppercase opacity-70"
                                style={{ color: isHidden ? "var(--muted-foreground)" : "var(--foreground)" }}
                            >
                                {item.name} - {billedLabel}
                            </span>
                        </div>
                        {(
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3.5 h-3.5 rounded border border-white/20"
                                    style={{
                                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${isHidden ? "transparent" : item.color} 2px, ${isHidden ? "transparent" : item.color} 4px)`,
                                        backgroundSize: "6px 6px",
                                    }}
                                />
                                <span
                                    className="text-[10px] font-bold tracking-wider uppercase opacity-70"
                                    style={{ color: isHidden ? "var(--muted-foreground)" : "var(--foreground)" }}
                                >
                                    {item.name} - {plannedLabel}
                                </span>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export function BudgetChart({ data, view, brands, brandColors }: {
    data: BudgetChartPoint[]
    view?: "week" | "month"
    brands: string[]
    brandColors: Record<string, string>
}) {
    const { t } = useLanguage()
    const billedLabel = t("budget.billed")
    const plannedLabel = t("budget.planned")
    const yAxisLabel = t("budget.yAxisLabel")

    const brandSeries: BrandSeries[] = brands.map(b => ({
        key: b,
        label: b,
        color: brandCssColor(b, brandColors),
    }))

    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({})

    const toggleSeries = (key: string) => {
        setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // Detect available width to decide whether to show date range in ticks
    const containerRef = useRef<HTMLDivElement>(null)
    const [chartWidth, setChartWidth] = useState(900)

    useEffect(() => {
        if (!containerRef.current) return
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) setChartWidth(entry.contentRect.width)
        })
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    const isWeekView = view === "week"
    // ~55px per tick needed to show dates comfortably
    const showDates = isWeekView && data.length > 0 && (chartWidth / data.length) >= 55

    return (
        <div className="flex flex-col w-full h-full" ref={containerRef}>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 0, bottom: isWeekView ? 15 : 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                        <XAxis
                            dataKey="period"
                            tickLine={false}
                            axisLine={false}
                            height={isWeekView ? (showDates ? 55 : 38) : 38}
                            interval={0}
                            tick={isWeekView
                                ? (props: any) => <WeekTick {...props} chartData={data} showDates={showDates} />
                                : (props: any) => <MonthTick {...props} />
                            }
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dx={-10}
                            label={{
                                value: yAxisLabel,
                                angle: -90,
                                position: "insideLeft",
                                style: { fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 },
                                offset: 15
                            }}
                        />
                        <Tooltip content={<CustomTooltip billedLabel={billedLabel} plannedLabel={plannedLabel} brandSeries={brandSeries} />} />

                        {brandSeries.map((brand) => (
                            <Line
                                key={`${brand.key}_billed`}
                                type="monotone"
                                hide={hiddenSeries[brand.key]}
                                dataKey={`${brand.key}_billed`}
                                stroke={brand.color}
                                strokeWidth={3}
                                dot={{ fill: brand.color, r: 5, strokeWidth: 0 }}
                                activeDot={{ r: 7, strokeWidth: 2, stroke: "var(--background)" }}
                                animationDuration={1000}
                                name={`${brand.label} - Facturé`}
                            />
                        ))}

                        <Line
                            type="monotone"
                            hide={hiddenSeries.Total}
                            dataKey="Total_billed"
                            stroke={totalColor}
                            strokeWidth={4}
                            dot={{ fill: totalColor, r: 6, strokeWidth: 0 }}
                            activeDot={{ r: 8, strokeWidth: 2, stroke: "var(--background)" }}
                            animationDuration={1000}
                            name="Total - Facturé"
                        />

                        {brandSeries.map((brand) => (
                            <Line
                                key={`${brand.key}_planned`}
                                type="monotone"
                                hide={hiddenSeries[brand.key]}
                                dataKey={`${brand.key}_planned`}
                                stroke={brand.color}
                                strokeWidth={2}
                                strokeDasharray="8 4"
                                dot={{ fill: brand.color, r: 4, strokeWidth: 0, opacity: 0.6 }}
                                opacity={0.6}
                                animationDuration={1000}
                                name={`${brand.label} - Prévu`}
                            />
                        ))}

                        <Line
                            type="monotone"
                            hide={hiddenSeries.Total}
                            dataKey="Total_planned"
                            stroke={totalColor}
                            strokeWidth={3}
                            strokeDasharray="8 4"
                            dot={{ fill: totalColor, r: 5, strokeWidth: 0, opacity: 0.7 }}
                            opacity={0.7}
                            animationDuration={1000}
                            name="Total - Prévu"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <CustomLegend hiddenSeries={hiddenSeries} toggleSeries={toggleSeries} billedLabel={billedLabel} plannedLabel={plannedLabel} brandSeries={brandSeries} />
        </div>
    )
}

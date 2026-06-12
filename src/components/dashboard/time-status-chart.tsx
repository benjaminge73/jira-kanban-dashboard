"use client"

import { useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export type TimeStatusData = {
    status: string
    [seriesKey: string]: string | number | null
}

const AVERAGE_KEY = "Moyenne"
const averageColor = "var(--brand-average, #f97316)"

// CSS variable (overridable in globals.css) with a hex fallback from the data source
function brandCssColor(brand: string, brandColors: Record<string, string>): string {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "")
    return `var(--brand-${slug}, ${brandColors[brand] || "#999"})`
}

/** Compute cumulative running totals per series, keeping per-status original values alongside (_key) */
function toCumulative(data: TimeStatusData[], seriesKeys: string[]): TimeStatusData[] {
    const sums: Record<string, number> = {}
    return data.map(pt => {
        const out: TimeStatusData = { status: pt.status }
        for (const key of seriesKeys) {
            const value = pt[key]
            if (typeof value === "number") {
                sums[key] = (sums[key] || 0) + value
                out[key] = Number(sums[key].toFixed(1))
            } else {
                out[key] = null
            }
            out[`_${key}`] = typeof value === "number" ? value : null
        }
        return out
    })
}

export function TimeStatusChart({ data, brands, brandColors }: {
    data: TimeStatusData[]
    brands: string[]
    brandColors: Record<string, string>
}) {
    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({})

    const seriesKeys = [
        ...brands.map(brand => ({ key: brand, color: brandCssColor(brand, brandColors) })),
        { key: AVERAGE_KEY, color: averageColor },
    ]

    const cumulativeData = toCumulative(data, seriesKeys.map(s => s.key))

    const toggleSeries = (dataKey: string) => {
        setHiddenSeries(prev => ({ ...prev, [dataKey]: !prev[dataKey] }))
    }

    const CustomTooltip = ({ active, label }: any) => {
        if (!active) return null

        // Find the original per-status data for the hovered status
        const originalPoint = cumulativeData.find(d => d.status === label)
        if (!originalPoint) return null

        // Build per-status display entries from the original (non-cumulative) values
        const perStatusEntries = seriesKeys.map(({ key, color }) => ({
            key,
            color,
            perStatus: originalPoint[`_${key}`] as number | null,
        }))

        // Only show visible, non-null entries, sorted by per-status value desc (average last)
        const visible = perStatusEntries
            .filter(e => !hiddenSeries[e.key] && e.perStatus !== null)
            .sort((a, b) => {
                if (a.key === AVERAGE_KEY) return 1
                if (b.key === AVERAGE_KEY) return -1
                return (b.perStatus ?? 0) - (a.perStatus ?? 0)
            })

        if (visible.length === 0) return null

        return (
            <div className="bg-card/95 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl min-w-[200px]"
                style={{ borderColor: "rgba(0,212,255,0.15)" }}>
                <p className="text-sm font-bold text-foreground mb-2 border-b border-border/50 pb-2">{label}</p>
                <div className="space-y-1.5">
                    {visible.map(e => (
                        <div key={e.key} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: e.color }} />
                                <span className="text-xs font-semibold text-muted-foreground">{e.key}</span>
                            </div>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-sm font-bold font-mono text-foreground">
                                    {Number(e.perStatus).toFixed(1)}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/60">d</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const renderCustomLegend = () => (
        <div className="flex flex-wrap justify-center gap-8 pt-4 mt-2 border-t border-border/30">
            {seriesKeys.map(({ key, color }) => {
                const isHidden = hiddenSeries[key]
                return (
                    <div
                        key={key}
                        className={`flex items-center gap-2.5 cursor-pointer transition-all duration-300 hover:scale-105 select-none ${isHidden ? "opacity-20 grayscale" : "opacity-100"}`}
                        onClick={() => toggleSeries(key)}
                    >
                        <div
                            className="w-3.5 h-3.5 rounded-full shadow-inner border border-white/20 flex items-center justify-center"
                            style={{ backgroundColor: isHidden ? "transparent" : color, borderColor: color }}
                        >
                            {!isHidden && <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
                        </div>
                        <span
                            className="text-xs font-bold tracking-wider uppercase opacity-80"
                            style={{ color: isHidden ? "var(--muted-foreground)" : "var(--foreground)" }}
                        >
                            {key}
                        </span>
                    </div>
                )
            })}
        </div>
    )

    return (
        <div className="flex flex-col w-full h-full">
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={cumulativeData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                        <XAxis
                            dataKey="status"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dy={15}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dx={-10}
                            unit=" d"
                        />
                        <Tooltip
                            cursor={{
                                stroke: "#00d4ff",
                                strokeWidth: 1.5,
                                strokeDasharray: "5 4",
                                strokeOpacity: 0.6,
                            }}
                            content={<CustomTooltip />}
                            wrapperStyle={{ zIndex: 10 }}
                        />
                        {seriesKeys.map(({ key, color }) => (
                            <Line key={key} type="monotone" dataKey={key} name={key}
                                stroke={color}
                                strokeWidth={key === AVERAGE_KEY ? 3 : 2.5}
                                strokeDasharray={key === AVERAGE_KEY ? "10 5" : undefined}
                                dot={{ r: 4, strokeWidth: 2, fill: "var(--card)", stroke: color }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                                hide={hiddenSeries[key]} animationDuration={800} connectNulls={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {renderCustomLegend()}
        </div>
    )
}

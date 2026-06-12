"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useLanguage } from "@/lib/i18n/context"

export interface ThroughputChartPoint {
    period: string
    [brand: string]: number | string
}

function brandSlug(brand: string): string {
    return brand.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// CSS variable (overridable in globals.css) with a hex fallback from the data source
function brandCssColor(brand: string, brandColors: Record<string, string>): string {
    return `var(--brand-${brandSlug(brand)}, ${brandColors[brand] || "#999"})`
}

function CustomTooltip({ active, payload, label, totalLabel, ticketsLabel }: {
    active?: boolean
    payload?: Array<{ dataKey: string; value: number; color: string }>
    label?: string
    totalLabel: string
    ticketsLabel: string
}) {
    if (!active || !payload || payload.length === 0) return null
    const total = payload.reduce((acc, entry) => acc + (entry.value || 0), 0)
    return (
        <div className="bg-card/95 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl min-w-[180px]">
            <p className="text-sm font-bold text-foreground mb-2 border-b border-border/50 pb-2">{label}</p>
            <div className="space-y-1">
                {payload.map((entry) => (
                    <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs font-semibold uppercase text-muted-foreground">{entry.dataKey}</span>
                        </div>
                        <span className="text-sm font-bold font-mono text-foreground">{entry.value}</span>
                    </div>
                ))}
                <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground">{totalLabel}</span>
                    <span className="text-sm font-bold font-mono text-foreground">{total} {ticketsLabel}</span>
                </div>
            </div>
        </div>
    )
}

export function ThroughputChart({ data, brands, brandColors }: {
    data: ThroughputChartPoint[]
    brands: string[]
    brandColors: Record<string, string>
}) {
    const { t } = useLanguage()

    return (
        <div className="flex flex-col w-full h-full">
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                        <XAxis
                            dataKey="period"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dy={15}
                        />
                        <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dx={-10}
                        />
                        <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                            content={<CustomTooltip totalLabel={t("dashboard.throughputTotal")} ticketsLabel={t("quality.tickets")} />}
                        />
                        {brands.map((brand) => (
                            <Bar
                                key={brand}
                                dataKey={brand}
                                stackId="throughput"
                                fill={brandCssColor(brand, brandColors)}
                                animationDuration={1000}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-6 pt-6 mt-4 border-t border-border/30">
                {brands.map((brand) => (
                    <div key={brand} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded border border-white/20" style={{ backgroundColor: brandCssColor(brand, brandColors) }} />
                        <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">{brand}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

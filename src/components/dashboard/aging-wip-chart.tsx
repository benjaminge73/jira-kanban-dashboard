"use client"

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts"
import { CANONICAL_PIPELINE } from "@/lib/flow/statuses"
import { useLanguage } from "@/lib/i18n/context"

export interface AgingWipChartItem {
    issue_key: string
    summary: string
    brand: string
    status: string
    rank: number
    ageDays: number
}

function brandSlug(brand: string): string {
    return brand.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// CSS variable (overridable in globals.css) with a hex fallback from the data source
function brandCssColor(brand: string, brandColors: Record<string, string>): string {
    return `var(--brand-${brandSlug(brand)}, ${brandColors[brand] || "#999"})`
}

// Deterministic horizontal jitter so overlapping tickets in the same column stay visible
function jitter(issueKey: string): number {
    let hash = 0
    for (let i = 0; i < issueKey.length; i++) hash = (hash * 31 + issueKey.charCodeAt(i)) | 0
    return ((Math.abs(hash) % 19) - 9) / 50 // [-0.18, +0.18]
}

function CustomTooltip({ active, payload, daysLabel }: {
    active?: boolean
    payload?: Array<{ payload: AgingWipChartItem }>
    daysLabel: string
}) {
    if (!active || !payload || payload.length === 0) return null
    const item = payload[0].payload
    return (
        <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl max-w-[260px]">
            <p className="text-sm font-bold text-foreground">{item.issue_key} · {item.brand}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{item.summary}</p>
            <p className="text-xs mt-2">
                <span className="font-mono font-bold text-foreground">{item.ageDays} {daysLabel}</span>
                <span className="text-muted-foreground"> — {item.status}</span>
            </p>
        </div>
    )
}

export function AgingWipChart({ items, p50, p85, brands, brandColors }: {
    items: AgingWipChartItem[]
    p50: number | null
    p85: number | null
    brands: string[]
    brandColors: Record<string, string>
}) {
    const { t } = useLanguage()
    const daysLabel = t("common.daysShort")

    const maxAge = Math.max(...items.map((i) => i.ageDays), p85 ?? 0, p50 ?? 0)
    const yMax = Math.ceil(maxAge * 1.15) + 1

    const dataByBrand = brands.map((brand) => ({
        brand,
        data: items
            .filter((i) => i.brand === brand)
            .map((i) => ({ ...i, x: i.rank + jitter(i.issue_key) })),
    }))

    return (
        <div className="flex flex-col w-full h-full">
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                        <XAxis
                            type="number"
                            dataKey="x"
                            domain={[0.5, 5.5]}
                            ticks={[1, 2, 3, 4, 5]}
                            tickFormatter={(rank: number) => CANONICAL_PIPELINE[rank] ?? ""}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dy={15}
                        />
                        <YAxis
                            type="number"
                            dataKey="ageDays"
                            domain={[0, yMax]}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
                            dx={-10}
                        />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip daysLabel={daysLabel} />} />
                        {p50 !== null && (
                            <ReferenceLine
                                y={p50}
                                stroke="var(--muted-foreground)"
                                strokeDasharray="6 4"
                                label={{ value: `P50 (${p50})`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 700 }}
                            />
                        )}
                        {p85 !== null && (
                            <ReferenceLine
                                y={p85}
                                stroke="#ef4444"
                                strokeDasharray="6 4"
                                label={{ value: `P85 (${p85})`, position: "insideTopRight", fill: "#ef4444", fontSize: 10, fontWeight: 700 }}
                            />
                        )}
                        {dataByBrand.map(({ brand, data }) => (
                            <Scatter
                                key={brand}
                                name={brand}
                                data={data}
                                fill={brandCssColor(brand, brandColors)}
                                fillOpacity={0.85}
                                stroke="var(--background)"
                                strokeWidth={1}
                            />
                        ))}
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-6 pt-6 mt-4 border-t border-border/30">
                {brands.map((brand) => (
                    <div key={brand} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: brandCssColor(brand, brandColors) }} />
                        <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">{brand}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

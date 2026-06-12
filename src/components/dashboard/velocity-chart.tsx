"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { VelocityData } from "@/lib/actions/kpis"
import { useState } from "react"
import { useLanguage } from "@/lib/i18n/context"

function brandSlug(brand: string): string {
    return brand.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// CSS variable (overridable in globals.css) with a hex fallback from the data source
function brandCssColor(brand: string, brandColors: Record<string, string>): string {
    return `var(--brand-${brandSlug(brand)}, ${brandColors[brand] || "#999"})`
}

function parseName(name: string): { brand: string; type: "planned" | "actual" } {
    const idx = name.lastIndexOf('_')
    return { brand: name.slice(0, idx), type: name.slice(idx + 1) as "planned" | "actual" }
}

function CustomTooltip({ active, payload, label, plannedLabel, actualLabel, brands, brandColors }: any) {
    if (!active || !payload || payload.length === 0) return null;

    const grouped: Record<string, { planned?: number; actual?: number; color: string }> = {};
    for (const entry of payload) {
        const { brand, type } = parseName(entry.dataKey);
        if (!grouped[brand]) grouped[brand] = { color: entry.color };
        grouped[brand][type] = entry.value;
    }

    const sorted = (brands as string[]).filter(b => grouped[b]);

    return (
        <div className="bg-card/95 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl min-w-[220px]">
            <p className="text-sm font-bold text-foreground mb-3 border-b border-border/50 pb-2">{label}</p>
            <div className="space-y-3">
                {sorted.map((brand) => {
                    const g = grouped[brand];
                    const dotColor = brandCssColor(brand, brandColors);
                    return (
                        <div key={brand}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: dotColor }} />
                                <span className="text-sm font-bold tracking-wider uppercase text-foreground">{brand}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-5">
                                {g.planned !== undefined && (
                                    <>
                                        <span className="text-xs text-muted-foreground font-semibold">{plannedLabel}</span>
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-sm font-bold font-mono text-foreground">{g.planned}</span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">SP</span>
                                        </div>
                                    </>
                                )}
                                {g.actual !== undefined && (
                                    <>
                                        <span className="text-xs text-muted-foreground font-semibold">{actualLabel}</span>
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-sm font-bold font-mono text-foreground">{g.actual}</span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">WD</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CustomLegend({ hiddenSeries, toggleSeries, plannedLabel, actualLabel, brands, brandColors }: {
    hiddenSeries: Record<string, boolean>
    toggleSeries: (brand: string) => void
    plannedLabel: string
    actualLabel: string
    brands: string[]
    brandColors: Record<string, string>
}) {
    return (
        <div className="flex flex-wrap justify-center gap-8 pt-8 mt-6 border-t border-border/30">
            {brands.map((name) => {
                const color = brandCssColor(name, brandColors);
                const isHidden = hiddenSeries[name];
                return (
                    <div
                        key={name}
                        className={`flex items-center gap-5 cursor-pointer transition-all duration-300 hover:scale-105 ${isHidden ? "opacity-30 grayscale" : "opacity-100"}`}
                        onClick={() => toggleSeries(name)}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3.5 h-3.5 rounded border border-white/20"
                                style={{
                                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${isHidden ? "transparent" : color} 2px, ${isHidden ? "transparent" : color} 4px)`,
                                    backgroundSize: "6px 6px",
                                    backgroundColor: "transparent"
                                }}
                            />
                            <span className="text-[10px] font-bold tracking-wider uppercase opacity-70"
                                style={{ color: isHidden ? "var(--muted-foreground)" : "var(--foreground)" }}>
                                {name} - {plannedLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3.5 h-3.5 rounded-full shadow-inner border border-white/20 flex items-center justify-center"
                                style={{ backgroundColor: isHidden ? "transparent" : color }}
                            >
                                {!isHidden && <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
                            </div>
                            <span className="text-[10px] font-bold tracking-wider uppercase opacity-70"
                                style={{ color: isHidden ? "var(--muted-foreground)" : "var(--foreground)" }}>
                                {name} - {actualLabel}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function VelocityChart({ data, brands, brandColors }: {
    data: VelocityData[]
    brands: string[]
    brandColors: Record<string, string>
}) {
    const { t } = useLanguage()
    const plannedLabel = t("dashboard.planned")
    const actualLabel = t("dashboard.actual")

    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

    const toggleSeries = (brand: string) => {
        setHiddenSeries((prev: Record<string, boolean>) => ({ ...prev, [brand]: !prev[brand] }));
    };

    return (
        <div className="flex flex-col w-full h-full">
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                        <defs>
                            {brands.map((brand) => (
                                <pattern key={brand} id={`pattern-${brandSlug(brand)}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                                    <rect width="8" height="8" fill="var(--background)" />
                                    <line x1="0" y1="0" x2="0" y2="8" stroke={brandCssColor(brand, brandColors)} strokeWidth="4" />
                                </pattern>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                        <XAxis
                            dataKey="period"
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
                        />
                        <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                            content={<CustomTooltip plannedLabel={plannedLabel} actualLabel={actualLabel} brands={brands} brandColors={brandColors} />}
                        />
                        {brands.map((brand) => {
                            const color = brandCssColor(brand, brandColors)
                            return [
                                <Bar key={`${brand}_planned`} dataKey={`${brand}_planned`} hide={hiddenSeries[brand]} fill={`url(#pattern-${brandSlug(brand)})`} stroke={color} strokeWidth={1} radius={[4, 4, 0, 0]} animationDuration={1000} />,
                                <Bar key={`${brand}_actual`} dataKey={`${brand}_actual`} hide={hiddenSeries[brand]} fill={color} radius={[4, 4, 0, 0]} animationDuration={1000} />,
                            ]
                        })}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <CustomLegend hiddenSeries={hiddenSeries} toggleSeries={toggleSeries} plannedLabel={plannedLabel} actualLabel={actualLabel} brands={brands} brandColors={brandColors} />
        </div>
    )
}

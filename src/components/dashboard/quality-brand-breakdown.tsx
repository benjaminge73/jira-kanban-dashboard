"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

// CSS variable (overridable in globals.css) with a hex fallback from the data source
function brandCssColor(brand: string, brandColors: Record<string, string>): string {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "")
    return `var(--brand-${slug}, ${brandColors[brand] || "#999"})`
}

function CustomTooltip({ active, payload, label, brandColors }: any) {
    if (active && payload && payload.length) {
        const value = payload[0].value;
        const brand = label;
        return (
            <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl min-w-[150px]">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brandCssColor(brand, brandColors) }} />
                    <span className="text-sm font-bold text-foreground">{brand}</span>
                </div>
                <div className="flex items-baseline gap-1 pl-5">
                    <span className="text-lg font-bold font-mono text-foreground">{value}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60">% FTR</span>
                </div>
            </div>
        );
    }
    return null;
}

export function QualityBrandBreakdown({ data, brandColors }: {
    data: { brand: string, ftr: number }[]
    brandColors: Record<string, string>
}) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                No data per brand.
            </div>
        )
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.2} />
                    <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }} />
                    <YAxis dataKey="brand" type="category" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }} dx={-10} width={60} />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.2 }} content={<CustomTooltip brandColors={brandColors} />} />
                    <Bar dataKey="ftr" radius={[0, 4, 4, 0]} animationDuration={1000} barSize={30}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={brandCssColor(entry.brand, brandColors)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

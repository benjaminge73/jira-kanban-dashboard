"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const COLORS = {
    Dev: "var(--brand-aapl, #a2aaad)", // Red
    QA: "var(--brand-msft, #00a4ef)",    // Blue
    Business: "var(--brand-average, #f97316)" // Orange
}

function CustomTooltip({ active, payload }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl min-w-[150px]">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.fill || COLORS[data.name as keyof typeof COLORS] }} />
                    <span className="text-sm font-bold text-foreground">{data.name}</span>
                </div>
                <div className="flex items-baseline gap-1 pl-5">
                    <span className="text-lg font-bold font-mono text-foreground">{data.value}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60">rejets</span>
                </div>
            </div>
        );
    }
    return null;
}

export function QualityReasonsChart({ data }: { data: { name: string, value: number }[] }) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0)

    if (total === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center border-2 border-dashed rounded-lg opacity-50">
                Aucun rejet détecté.
            </div>
        )
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        animationDuration={1000}
                        stroke="var(--background)"
                        strokeWidth={2}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || "var(--chart-1)"} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

"use client"

import { BackflowKPIs } from "@/types/kanban"
import { TrendMetricCard } from "./trend-metric-card"
import { useLanguage } from "@/lib/i18n/context"

export function QualityKpiCards({
    kpis,
    ftrPoints,
    ftrMandays,
    pastFtrPct,
    pastFtrPoints,
    pastFtrMandays,
    totalPoints,
    totalMandays,
}: {
    kpis: BackflowKPIs,
    ftrPoints: number,
    ftrMandays: number,
    pastFtrPct: number | null,
    pastFtrPoints: number | null,
    pastFtrMandays: number | null,
    totalPoints: number,
    totalMandays: number
}) {
    const { t, locale } = useLanguage()
    const totalTickets = kpis.total_tickets
    const ftrTickets = totalTickets - kpis.tickets_with_rejection
    const ftrPtsVolume = totalPoints > 0 ? (ftrPoints / 100) * totalPoints : 0
    const ftrJhVolume = totalMandays > 0 ? (ftrMandays / 100) * totalMandays : 0

    const getVariant = (ftrValue: number): "success" | "warning" | "danger" => {
        if (ftrValue >= 85) return "success"
        if (ftrValue >= 70) return "warning"
        return "danger"
    }

    const tooltipText = t("quality.ftrTooltip")

    return (
        <div className="grid gap-6 md:grid-cols-3">
            <TrendMetricCard
                titleKey="quality.ftrVolume"
                value={`${kpis.first_time_right_pct.toFixed(1)}%`}
                subtitle={`${ftrTickets} / ${totalTickets} tickets`}
                currentPct={kpis.first_time_right_pct}
                pastPct={pastFtrPct}
                higherIsBetter={true}
                tooltip={tooltipText}
                variant={getVariant(kpis.first_time_right_pct)}
            />
            <TrendMetricCard
                titleKey="quality.ftrSP"
                value={`${ftrPoints.toFixed(1)}%`}
                subtitle={`${ftrPtsVolume.toFixed(1)} / ${totalPoints.toFixed(1)} SP`}
                currentPct={ftrPoints}
                pastPct={pastFtrPoints}
                higherIsBetter={true}
                tooltip={tooltipText}
                variant={getVariant(ftrPoints)}
            />
            <TrendMetricCard
                titleKey="quality.ftrEffort"
                value={`${ftrMandays.toFixed(1)}%`}
                subtitle={`${ftrJhVolume.toFixed(1)} / ${totalMandays.toFixed(1)} ${locale === "fr" ? "JH" : "WD"}`}
                currentPct={ftrMandays}
                pastPct={pastFtrMandays}
                higherIsBetter={true}
                tooltip={tooltipText}
                variant={getVariant(ftrMandays)}
            />
        </div>
    )
}

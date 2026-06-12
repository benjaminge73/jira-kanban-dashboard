"use client"

import { useLanguage } from "@/lib/i18n/context"

export interface ForecastTableRow {
    weeks: number
    p85: number
    p50: number
}

export function ForecastTable({ rows, historyWeeks }: { rows: ForecastTableRow[]; historyWeeks: number }) {
    const { t } = useLanguage()

    if (rows.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">{t("dashboard.forecastInsufficient")}</p>
        )
    }

    return (
        <div>
            <div className="flex items-baseline justify-between mb-3">
                <h4 className="text-sm font-bold text-foreground">🎲 {t("dashboard.forecastTitle")}</h4>
                <span className="text-xs text-muted-foreground">
                    {t("dashboard.forecastDesc", { n: String(historyWeeks) })}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                    {t("dashboard.forecastHorizon")}
                </div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 text-right">
                    {t("dashboard.forecastConservative")}
                </div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 text-right">
                    {t("dashboard.forecastMedian")}
                </div>
                {rows.map((row) => (
                    <div key={row.weeks} className="contents">
                        <div className="px-3 py-2 rounded-l-lg bg-muted/30 font-medium">
                            {t("dashboard.forecastWeeks", { n: String(row.weeks) })}
                        </div>
                        <div className="px-3 py-2 bg-muted/30 text-right font-mono font-bold text-emerald-500">
                            ≥ {row.p85}
                        </div>
                        <div className="px-3 py-2 rounded-r-lg bg-muted/30 text-right font-mono font-bold">
                            ≥ {row.p50}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

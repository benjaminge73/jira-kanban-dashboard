"use client"

import React from "react"
import { useLanguage } from "@/lib/i18n/context"
import type { TranslationKey } from "@/lib/i18n/translations"

export function TrendMetricCard({
    title,
    titleKey,
    value,
    subtitle,
    currentPct,
    pastValue,
    pastPct,
    tooltip,
    higherIsBetter = true,
    isColoredCard = false,
    variant = "default"
}: {
    title?: string | React.ReactNode,
    titleKey?: TranslationKey,
    value: string,
    subtitle?: string,
    currentPct?: number | null,
    pastValue?: string | null,
    pastPct?: number | null,
    tooltip?: React.ReactNode,
    higherIsBetter?: boolean,
    isColoredCard?: boolean,
    variant?: "default" | "success" | "warning" | "danger"
}) {
    const { t } = useLanguage()

    let colorClass = "text-foreground";
    let bgClass = "bg-card";

    let trendLabel: string | null = null
    let trendIsGood: boolean | null = null

    let delta = 0;
    let hasDelta = false;

    if (currentPct !== undefined && currentPct !== null && pastPct !== undefined && pastPct !== null) {
        delta = currentPct - pastPct;
        hasDelta = true;
    } else if (pastValue) {
        const cv = parseFloat(value);
        const pv = parseFloat(pastValue);
        if (!isNaN(cv) && !isNaN(pv)) {
            delta = cv - pv;
            hasDelta = true;
        }
    }

    if (hasDelta) {
        if (Math.abs(delta) >= 0.5) {
            trendIsGood = higherIsBetter ? delta > 0 : delta < 0;
            const sign = delta > 0 ? "+" : "-";
            const formattedDelta = (currentPct !== undefined) ? `${Math.abs(delta).toFixed(1)}%` : Math.abs(delta).toFixed(1);
            trendLabel = `${sign}${formattedDelta} ${t("trend.vsPrev")}`;
        } else {
            trendLabel = t("trend.stable");
            trendIsGood = true;
        }
    }

    let borderClass = variant && variant !== "default" ? {
        default: "",
        success: "border-emerald-500/30",
        warning: "border-amber-500/30",
        danger: "border-red-500/30",
    }[variant] : "";

    if (isColoredCard && currentPct !== undefined && currentPct !== null) {
        const isGoodState = higherIsBetter ? currentPct >= 100 : currentPct <= 100;
        colorClass = isGoodState ? "text-emerald-500" : "text-red-500";
        borderClass = isGoodState ? "border-emerald-500/30" : "border-red-500/30";
    }

    const resolvedTitle = titleKey ? t(titleKey) : title

    return (
        <div className={`rounded-xl border shadow-sm ${bgClass} ${borderClass}`}>
            <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                    <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{resolvedTitle}</h3>
                    {tooltip && (
                        <div className="group relative flex items-center cursor-help">
                            <span className="text-muted-foreground hover:text-foreground transition-colors text-xs">💡</span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-64 p-3 bg-popover text-popover-foreground text-xs rounded-md shadow-md border group-hover:block z-50">
                                {tooltip}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="p-6 pt-0 space-y-1">
                <div className={`text-3xl font-bold font-mono tracking-tighter flex items-end gap-2 ${colorClass}`}>
                    {value}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>}

                {trendLabel && (
                    <div className={`text-xs font-semibold pt-1 ${trendIsGood === null ? "text-muted-foreground" :
                        trendIsGood ? "text-emerald-500" : "text-red-500"
                        }`}>
                        {trendLabel}
                    </div>
                )}
            </div>
        </div>
    )
}

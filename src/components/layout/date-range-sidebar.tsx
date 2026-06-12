"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
    format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
    startOfYear, endOfYear, subMonths, addMonths, subQuarters, getYear, subDays,
    getDaysInMonth, getDay, isBefore, isAfter, isSameDay
} from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronDown, Filter } from "lucide-react"
import { Disclosure } from "@headlessui/react"
import type { CalendarBounds } from "@/lib/data-source/types"

type Preset = 'month' | 'prev-month' | 'quarter' | 'prev-quarter' | 'year' | 'prev-2weeks' | 'all'

// ── helpers ──────────────────────────────────────────────────────────────────

function getPresetRange(preset: Preset, today: Date): { from: Date; to: Date | null } {
    switch (preset) {
        case 'month':
            return { from: startOfMonth(today), to: endOfMonth(today) }
        case 'prev-month': {
            const p = subMonths(today, 1)
            return { from: startOfMonth(p), to: endOfMonth(p) }
        }
        case 'quarter':
            return { from: startOfQuarter(today), to: endOfQuarter(today) }
        case 'prev-quarter': {
            const p = subQuarters(today, 1)
            return { from: startOfQuarter(p), to: endOfQuarter(p) }
        }
        case 'year':
            return { from: startOfYear(today), to: endOfYear(today) }
        case 'prev-2weeks': {
            return { from: subDays(today, 16), to: subDays(today, 2) }
        }
        case 'all':
            return { from: new Date(0), to: null }
    }
}

function formatPresetDates(from: Date, to: Date | null, today: Date): string {
    if (!to) return "—"
    const thisYear = getYear(today)
    const fromYear = getYear(from)
    const toYear = getYear(to)
    const sameYear = fromYear === toYear

    const fmt = (d: Date, includeYear: boolean) =>
        includeYear ? format(d, "d MMM yyyy", { locale: fr }) : format(d, "d MMM", { locale: fr })

    if (sameYear && fromYear === thisYear) {
        return `${fmt(from, false)} – ${fmt(to, false)}`
    }
    if (sameYear) {
        return `${fmt(from, false)} – ${fmt(to, false)} ${toYear}`
    }
    return `${fmt(from, fromYear !== thisYear)} – ${fmt(to, toYear !== thisYear)}`
}

// ── component ─────────────────────────────────────────────────────────────────

export function DateRangeSidebar({ calendarBounds }: { calendarBounds: CalendarBounds | null }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    // Calendar navigation limits (demo data covers 2026 only; live mode is unrestricted)
    const MIN_MONTH = calendarBounds ? new Date(calendarBounds.minYear, 0, 1) : null
    const MAX_MONTH = calendarBounds ? new Date(calendarBounds.maxYear, 11, 1) : null
    const [displayMonth, setDisplayMonth] = React.useState<Date>(
        calendarBounds
            ? new Date(calendarBounds.minYear, new Date().getMonth(), 1)
            : startOfMonth(new Date())
    )

    const [date, setDate] = React.useState<{ from: Date | undefined; to: Date | undefined }>(() => {
        const fromParam = searchParams.get("from")
        const toParam = searchParams.get("to")
        const allParam = searchParams.get("all")
        if (!fromParam && !toParam && !allParam) {
            const today = new Date()
            return { from: startOfMonth(today), to: endOfMonth(today) }
        }
        return {
            from: fromParam ? new Date(fromParam) : undefined,
            to: toParam ? new Date(toParam) : undefined,
        }
    })

    React.useEffect(() => {
        const fromParam = searchParams.get("from")
        const toParam = searchParams.get("to")
        const allParam = searchParams.get("all")
        if (!fromParam && !toParam && !allParam) {
            try {
                const saved = localStorage.getItem("dateRange")
                if (saved) {
                    const { from, to, all } = JSON.parse(saved)
                    if (all) { applyDateRange(undefined, undefined); return }
                    applyDateRange(from ? new Date(from) : undefined, to ? new Date(to) : undefined)
                    return
                }
            } catch (_) { /* ignore */ }
            const today = new Date()
            applyDateRange(startOfMonth(today), endOfMonth(today))
        } else {
            setDate({
                from: fromParam ? new Date(fromParam) : undefined,
                to: toParam ? new Date(toParam) : undefined,
            })
        }
    }, [searchParams])

    const applyDateRange = (from?: Date, to?: Date) => {
        setDate({ from, to })
        const params = new URLSearchParams(searchParams.toString())
        if (from) { params.set("from", format(from, "yyyy-MM-dd")); params.delete("all") }
        else { params.delete("from") }
        if (to) { params.set("to", format(to, "yyyy-MM-dd")); params.delete("all") }
        else { params.delete("to") }
        if (!from && !to) params.set("all", "true")
        try {
            localStorage.setItem("dateRange", JSON.stringify({
                from: from ? format(from, "yyyy-MM-dd") : null,
                to: to ? format(to, "yyyy-MM-dd") : null,
                all: !from && !to,
            }))
        } catch (_) { /* ignore */ }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const setQuickFilter = (preset: Preset) => {
        if (preset === 'all') {
            applyDateRange(undefined, undefined)
            return
        }
        const today = new Date()
        const { from, to } = getPresetRange(preset, today)
        applyDateRange(from ?? undefined, to ?? undefined)
    }

    const isActivePreset = (preset: Preset): boolean => {
        if (preset === 'all') return !date.from && !date.to
        const today = new Date()
        const { from, to } = getPresetRange(preset, today)
        if (!to) return false
        const cf = date.from ? format(date.from, 'yyyy-MM-dd') : ""
        const ct = date.to ? format(date.to, 'yyyy-MM-dd') : ""
        return cf === format(from, 'yyyy-MM-dd') && ct === format(to, 'yyyy-MM-dd')
    }

    const today = new Date()

    const quickFilters: { preset: Preset; label: string }[] = [
        { preset: 'prev-2weeks', label: "2 semaines précédentes" },
        { preset: 'month', label: "Mois en cours" },
        { preset: 'prev-month', label: "Mois précédent" },
        { preset: 'quarter', label: "Trimestre en cours" },
        { preset: 'prev-quarter', label: "Trimestre précédent" },
        { preset: 'year', label: "Année en cours" },
        { preset: 'all', label: "Tout afficher" },
    ]

    const hasCustomRange = date.from && !quickFilters.some(f => isActivePreset(f.preset))


    return (
        <div className="flex flex-col my-2 text-card-foreground font-sans">

            {/* Section header */}
            <div className="flex items-center gap-2 mb-2 px-2 pt-2 border-t border-border/50">
                <Filter className="w-3 h-3" style={{ color: "rgba(0,212,255,0.5)" }} />
                <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground/40">
                    Période
                </span>
            </div>

            {/* Preset list */}
            <div className="space-y-px">
                {quickFilters.map(({ preset, label }) => {
                    const active = isActivePreset(preset)
                    const { from, to } = getPresetRange(preset, today)
                    const dateStr = formatPresetDates(from, to, today)

                    return (
                        <button
                            key={preset}
                            onClick={() => setQuickFilter(preset)}
                            className={`w-full text-left py-1.5 px-3 rounded-md transition-all duration-150 flex items-center justify-between gap-2 group ${
                                active
                                    ? "text-neon-cyan"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            }`}
                            style={active ? {
                                background: "rgba(0,212,255,0.1)",
                                boxShadow: "inset 0 1px 0 rgba(0,212,255,0.1)"
                            } : undefined}
                        >
                            <span className="text-xs font-medium shrink-0">{label}</span>
                            <span className={`text-[10px] font-mono tabular-nums shrink-0 ${
                                active ? "text-neon-cyan/70" : "text-muted-foreground/40 group-hover:text-muted-foreground/60"
                            }`}>
                                {dateStr}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Personnalisé — Disclosure accordion */}
            <Disclosure defaultOpen={!!hasCustomRange}>
                {({ open }) => (
                    <div className="mt-2 border-t border-border/30 pt-2">
                        <Disclosure.Button
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all duration-150 ${
                                open || hasCustomRange
                                    ? "text-neon-cyan"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            }`}
                            style={(open || hasCustomRange) ? {
                                background: "rgba(0,212,255,0.1)",
                                boxShadow: "inset 0 1px 0 rgba(0,212,255,0.1)"
                            } : undefined}
                        >
                            <span className="font-medium">Personnalisé</span>
                            <ChevronDown
                                className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                            />
                        </Disclosure.Button>

                        <Disclosure.Panel className="mt-2">
                            {/* Calendar header */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <button
                                    onClick={() => {
                                        const prev = subMonths(displayMonth, 1)
                                        if (!MIN_MONTH || prev >= MIN_MONTH) setDisplayMonth(prev)
                                    }}
                                    className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                                    style={{ color: "#00d4ff" }}
                                    disabled={!!MIN_MONTH && displayMonth <= MIN_MONTH}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <span className="text-xs font-semibold text-foreground flex-1 text-center">
                                    {format(displayMonth, "MMMM yyyy", { locale: fr })}
                                </span>
                                <button
                                    onClick={() => {
                                        const next = addMonths(displayMonth, 1)
                                        if (!MAX_MONTH || next <= MAX_MONTH) setDisplayMonth(next)
                                    }}
                                    className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                                    style={{ color: "#00d4ff" }}
                                    disabled={!!MAX_MONTH && displayMonth >= MAX_MONTH}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Modern calendar grid */}
                            <div className="rounded-md border p-2" style={{ borderColor: "rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.02)" }}>
                                {/* Weekday headers */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((day) => (
                                        <div key={day} className="text-[9px] font-semibold text-muted-foreground/40 text-center py-1">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {(() => {
                                        const daysInMonth = getDaysInMonth(displayMonth)
                                        const firstDay = getDay(startOfMonth(displayMonth))
                                        const days = []

                                        // Empty cells for days before month starts
                                        for (let i = 0; i < firstDay; i++) {
                                            days.push(<div key={`empty-${i}`} />)
                                        }

                                        // Days of month
                                        for (let i = 1; i <= daysInMonth; i++) {
                                            const currentDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), i)
                                            const isSelected = date.from && date.to && (isSameDay(currentDate, date.from) || isSameDay(currentDate, date.to))
                                            const inRange = date.from && date.to && isAfter(currentDate, date.from) && isBefore(currentDate, date.to)

                                            days.push(
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        if (!date.from) {
                                                            applyDateRange(currentDate, undefined)
                                                        } else if (!date.to) {
                                                            applyDateRange(date.from, currentDate)
                                                        } else {
                                                            applyDateRange(currentDate, undefined)
                                                        }
                                                    }}
                                                    className={`h-6 rounded text-[10px] transition-all ${
                                                        isSelected
                                                            ? "bg-neon-cyan/30 text-neon-cyan font-semibold"
                                                            : inRange
                                                            ? "bg-neon-cyan/10 text-neon-cyan/70"
                                                            : "text-foreground hover:bg-white/5"
                                                    }`}
                                                >
                                                    {i}
                                                </button>
                                            )
                                        }

                                        return days
                                    })()}
                                </div>
                            </div>

                            {/* Date pill inputs */}
                            <div className="flex items-center gap-1.5 mt-2 px-1">
                                <div
                                    className="flex-1 px-2 py-1.5 rounded text-[10px] text-center font-mono transition-colors"
                                    style={{
                                        border: `1px solid ${date.from ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                                        color: date.from ? "#00d4ff" : "rgba(255,255,255,0.3)",
                                        background: date.from ? "rgba(0,212,255,0.06)" : "transparent",
                                    }}
                                >
                                    {date.from ? format(date.from, "dd/MM/yy") : "Début"}
                                </div>
                                <span className="text-muted-foreground/40 text-xs shrink-0">–</span>
                                <div
                                    className="flex-1 px-2 py-1.5 rounded text-[10px] text-center font-mono transition-colors"
                                    style={{
                                        border: `1px solid ${date.to ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                                        color: date.to ? "#00d4ff" : "rgba(255,255,255,0.3)",
                                        background: date.to ? "rgba(0,212,255,0.06)" : "transparent",
                                    }}
                                >
                                    {date.to ? format(date.to, "dd/MM/yy") : "Fin"}
                                </div>
                            </div>
                        </Disclosure.Panel>
                    </div>
                )}
            </Disclosure>
        </div>
    )
}

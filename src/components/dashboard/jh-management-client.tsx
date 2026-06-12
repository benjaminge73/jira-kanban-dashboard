"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Check, Loader2, Plus, Trash2, X, Pencil, ChevronLeft, ChevronRight } from "lucide-react"
import type { BilledDayEntry, PlannedRate } from "@/lib/actions/budget"
import {
    upsertBilledDay, deleteBilledPeriod,
    upsertPlannedRate, deletePlannedRate,
} from "@/lib/actions/jh"
import { useRouter } from "next/navigation"
import {
    format, addDays, getISOWeek, getDaysInMonth, getDay,
    startOfMonth, subMonths, addMonths, parseISO, endOfMonth,
} from "date-fns"
import { fr, enUS } from "date-fns/locale"
import { useLanguage } from "@/lib/i18n/context"

interface Props {
    billedWeeks: BilledDayEntry[]
    billedMonths: BilledDayEntry[]
    plannedRates: PlannedRate[]
    brands: string[]
    readOnly?: boolean
    liveMode?: boolean
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function normalizeWeekLabel(label: string): string {
    return label
        .replace(/^W(\d+)/, (_, n: string) => `S${n.padStart(2, '0')}`)
        .replace(/^Semaine (\d+)(.*)/i, (_, n: string, rest: string) => `S${String(n).padStart(2, '0')}${rest}`)
}

function formatWeekDates(startDate: string, endDate: string): string {
    return `${format(parseISO(startDate), 'dd/MM')} – ${format(parseISO(endDate), 'dd/MM')}`
}

function groupByPeriod(entries: BilledDayEntry[], brands: string[]): Map<string, Record<string, BilledDayEntry | undefined>> {
    const map = new Map<string, Record<string, BilledDayEntry | undefined>>()
    for (const entry of entries) {
        if (!map.has(entry.period_label)) {
            map.set(entry.period_label, Object.fromEntries(brands.map(b => [b, undefined])))
        }
        const row = map.get(entry.period_label)!
        row[entry.brand] = entry
    }
    return map
}

function sortPeriods(map: Map<string, Record<string, BilledDayEntry | undefined>>): [string, Record<string, BilledDayEntry | undefined>][] {
    return Array.from(map.entries()).sort(([, a], [, b]) => {
        const entryA = Object.values(a).find(Boolean)
        const entryB = Object.values(b).find(Boolean)
        if (!entryA || !entryB) return 0
        if (entryA.month_number !== entryB.month_number) return entryA.month_number - entryB.month_number
        return (entryA.week_number || 0) - (entryB.week_number || 0)
    })
}

// -------------------------------------------------------------------
// Period Range Picker — single calendar for start + end (like the sidebar)
// -------------------------------------------------------------------

function PeriodRangePicker({
    startDate,
    endDate,
    onStartChange,
    onEndChange,
    weekMode,
}: {
    startDate: string
    endDate: string
    onStartChange: (val: string) => void
    onEndChange: (val: string) => void
    weekMode: boolean
}) {
    const [open, setOpen] = useState(false)
    const [displayMonth, setDisplayMonth] = useState<Date>(() => {
        return startDate ? parseISO(startDate) : new Date()
    })
    // month mode: two-click selection (false = picking start, true = picking end)
    const [pickingEnd, setPickingEnd] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setPickingEnd(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    const handleDayClick = (dateStr: string) => {
        if (weekMode) {
            // week mode: one click → onStartChange handles auto-fill of end+label
            onStartChange(dateStr)
            setOpen(false)
        } else {
            if (!pickingEnd || !startDate) {
                onStartChange(dateStr)
                setPickingEnd(true)
            } else {
                if (dateStr < startDate) {
                    onEndChange(startDate)
                    onStartChange(dateStr)
                } else {
                    onEndChange(dateStr)
                }
                setPickingEnd(false)
                setOpen(false)
            }
        }
    }

    const { t } = useLanguage()
    const buttonLabel = startDate && endDate
        ? `${format(parseISO(startDate), 'dd/MM/yyyy')} – ${format(parseISO(endDate), 'dd/MM/yyyy')}`
        : startDate
            ? `${format(parseISO(startDate), 'dd/MM/yyyy')} – ?`
            : t("admin.period")

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => { setOpen(v => !v); setPickingEnd(false) }}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono whitespace-nowrap"
            >
                {buttonLabel}
            </button>

            {open && (
                <div
                    className="absolute bottom-full mb-1 left-0 z-50 rounded-xl border shadow-2xl p-3 bg-card min-w-[240px]"
                    style={{ borderColor: "rgba(0,212,255,0.2)", boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
                >
                    {!weekMode && pickingEnd && (
                        <p className="text-[10px] mb-2 text-center" style={{ color: "rgba(0,212,255,0.7)" }}>
                            {t("admin.readOnlyNote")}
                        </p>
                    )}
                    {!weekMode && !pickingEnd && (
                        <p className="text-[10px] mb-2 text-center text-muted-foreground/50">
                            {t("admin.period")}
                        </p>
                    )}

                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={() => setDisplayMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: "#00d4ff" }}>
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold text-foreground">
                            {format(displayMonth, "MMMM yyyy", { locale: fr })}
                        </span>
                        <button type="button" onClick={() => setDisplayMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: "#00d4ff" }}>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Calendar grid */}
                    <div className="rounded-md border p-2" style={{ borderColor: "rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.02)" }}>
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map(d => (
                                <div key={d} className="text-[9px] font-semibold text-muted-foreground/40 text-center py-1">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {(() => {
                                const daysInMonth = getDaysInMonth(displayMonth)
                                const firstDay = getDay(startOfMonth(displayMonth))
                                const offset = firstDay === 0 ? 6 : firstDay - 1
                                const cells = []
                                for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />)
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = format(
                                        new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d),
                                        'yyyy-MM-dd'
                                    )
                                    const isStart = dateStr === startDate
                                    const isEnd = dateStr === endDate
                                    const inRange = !!(startDate && endDate && dateStr > startDate && dateStr < endDate)
                                    cells.push(
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => handleDayClick(dateStr)}
                                            className={`h-6 rounded text-[10px] transition-all ${
                                                isStart || isEnd
                                                    ? "font-semibold"
                                                    : inRange
                                                        ? ""
                                                        : "text-foreground hover:bg-white/5"
                                            }`}
                                            style={
                                                isStart || isEnd
                                                    ? { background: "rgba(0,212,255,0.4)", color: "#00d4ff" }
                                                    : inRange
                                                        ? { background: "rgba(0,212,255,0.1)", color: "rgba(0,212,255,0.7)" }
                                                        : undefined
                                            }
                                        >
                                            {d}
                                        </button>
                                    )
                                }
                                return cells
                            })()}
                        </div>
                    </div>

                    {/* Range pills — same as sidebar */}
                    <div className="flex items-center gap-1.5 mt-2 px-1">
                        <div className="flex-1 px-2 py-1 rounded text-[10px] text-center font-mono"
                            style={{
                                border: `1px solid ${startDate ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                                color: startDate ? "#00d4ff" : "rgba(255,255,255,0.3)",
                                background: startDate ? "rgba(0,212,255,0.06)" : "transparent",
                            }}
                        >
                            {startDate ? format(parseISO(startDate), "dd/MM/yy") : "—"}
                        </div>
                        <span className="text-muted-foreground/40 text-xs shrink-0">–</span>
                        <div className="flex-1 px-2 py-1 rounded text-[10px] text-center font-mono"
                            style={{
                                border: `1px solid ${endDate ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                                color: endDate ? "#00d4ff" : "rgba(255,255,255,0.3)",
                                background: endDate ? "rgba(0,212,255,0.06)" : "transparent",
                            }}
                        >
                            {endDate ? format(parseISO(endDate), "dd/MM/yy") : "—"}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// -------------------------------------------------------------------
// Mini Date Picker — same calendar UI as the sidebar
// -------------------------------------------------------------------

function MiniDatePicker({
    value,
    onChange,
}: {
    value: string
    onChange: (val: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [displayMonth, setDisplayMonth] = useState<Date>(() => {
        return value ? parseISO(value) : new Date()
    })
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            >
                {value
                    ? format(parseISO(value), 'dd/MM/yyyy')
                    : <span className="text-muted-foreground/50">jj/mm/aaaa</span>
                }
            </button>

            {open && (
                <div
                    className="absolute bottom-full mb-1 left-0 z-50 rounded-xl border shadow-2xl p-3 bg-card min-w-[220px]"
                    style={{ borderColor: "rgba(0,212,255,0.2)", boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
                >
                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={() => setDisplayMonth(m => subMonths(m, 1))}
                            className="p-1 rounded hover:bg-white/5 transition-colors"
                            style={{ color: "#00d4ff" }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold text-foreground">
                            {format(displayMonth, "MMMM yyyy", { locale: fr })}
                        </span>
                        <button
                            type="button"
                            onClick={() => setDisplayMonth(m => addMonths(m, 1))}
                            className="p-1 rounded hover:bg-white/5 transition-colors"
                            style={{ color: "#00d4ff" }}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Calendar grid */}
                    <div className="rounded-md border p-2" style={{ borderColor: "rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.02)" }}>
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map(d => (
                                <div key={d} className="text-[9px] font-semibold text-muted-foreground/40 text-center py-1">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {(() => {
                                const daysInMonth = getDaysInMonth(displayMonth)
                                const firstDay = getDay(startOfMonth(displayMonth))
                                // Monday-first: Sun(0)→6, Mon(1)→0, …
                                const offset = firstDay === 0 ? 6 : firstDay - 1
                                const cells = []
                                for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />)
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = format(
                                        new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d),
                                        'yyyy-MM-dd'
                                    )
                                    const isSelected = value === dateStr
                                    cells.push(
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => { onChange(dateStr); setOpen(false) }}
                                            className={`h-6 rounded text-[10px] transition-all ${isSelected
                                                ? "font-semibold"
                                                : "text-foreground hover:bg-white/5"
                                            }`}
                                            style={isSelected ? { background: "rgba(0,212,255,0.3)", color: "#00d4ff" } : undefined}
                                        >
                                            {d}
                                        </button>
                                    )
                                }
                                return cells
                            })()}
                        </div>
                    </div>

                    {value && (
                        <div className="mt-2 text-center">
                            <span className="text-[10px] font-mono" style={{ color: "#00d4ff" }}>
                                {format(parseISO(value), "EEEE d MMMM yyyy", { locale: fr })}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// -------------------------------------------------------------------
// Cell with inline editing
// -------------------------------------------------------------------

function BilledCell({
    entry,
    periodLabel,
    brand,
    periodMeta,
    onSaved,
    readOnly = false,
}: {
    entry: BilledDayEntry | undefined
    periodLabel: string
    brand: string
    periodMeta: BilledDayEntry | undefined
    onSaved: () => void
    readOnly?: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(entry?.billed_days?.toString() ?? "")
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
    const inputRef = useRef<HTMLInputElement>(null)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        const num = parseFloat(value)
        if (isNaN(num)) { setEditing(false); return }
        if (entry && num === entry.billed_days) { setEditing(false); return }

        const meta = periodMeta || entry
        if (!meta) return

        setStatus("saving")
        startTransition(async () => {
            const result = await upsertBilledDay({
                period_type: meta.period_type,
                period_label: periodLabel,
                brand,
                billed_days: num,
                year: meta.year,
                week_number: meta.week_number,
                month_number: meta.month_number,
                start_date: meta.start_date,
                end_date: meta.end_date,
            })
            if (result.error) {
                setStatus("error")
            } else {
                setStatus("saved")
                onSaved()
                setTimeout(() => setStatus("idle"), 1500)
            }
            setEditing(false)
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave()
        if (e.key === "Escape") { setEditing(false); setValue(entry?.billed_days?.toString() ?? "") }
    }

    // Read-only: plain display, no editing
    if (readOnly) {
        return (
            <td className="px-3 py-2 text-right">
                <span className={`font-mono text-sm ${entry ? "text-foreground" : "text-muted-foreground/40"}`}>
                    {entry ? entry.billed_days.toFixed(1) : "—"}
                </span>
            </td>
        )
    }

    if (editing) {
        return (
            <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                    <input
                        ref={inputRef}
                        type="number"
                        step="0.1"
                        min="0"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-20 rounded-md border border-primary bg-background px-2 py-1 text-sm text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
            </td>
        )
    }

    return (
        <td
            className="px-3 py-2 text-right cursor-pointer group"
            onClick={() => {
                setEditing(true)
                setValue(entry?.billed_days?.toString() ?? "0")
            }}
        >
            <div className="flex items-center justify-end gap-1.5">
                {isPending || status === "saving" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : status === "saved" ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                ) : status === "error" ? (
                    <X className="h-3 w-3 text-destructive" />
                ) : null}
                <span className={`font-mono text-sm ${entry ? "text-foreground" : "text-muted-foreground/40"} group-hover:text-primary transition-colors`}>
                    {entry ? entry.billed_days.toFixed(1) : "—"}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
            </div>
        </td>
    )
}

// -------------------------------------------------------------------
// Add period form
// -------------------------------------------------------------------

function AddPeriodForm({
    periodType,
    brands,
    onAdded,
    onCancel,
    lastPeriod,
}: {
    periodType: "week" | "month"
    brands: string[]
    onAdded: () => void
    onCancel: () => void
    lastPeriod?: BilledDayEntry
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const getInitialValues = () => {
        if (periodType === "week" && lastPeriod?.end_date) {
            const nextStart = addDays(parseISO(lastPeriod.end_date), 1)
            const nextEnd = addDays(nextStart, 6)
            const weekNum = getISOWeek(nextStart)
            const year = nextStart.getFullYear()
            const monthNum = nextStart.getMonth() + 1
            return {
                period_label: `S${String(weekNum).padStart(2, '0')} ${year}`,
                year,
                month_number: monthNum,
                week_number: String(weekNum),
                start_date: format(nextStart, 'yyyy-MM-dd'),
                end_date: format(nextEnd, 'yyyy-MM-dd'),
            }
        }
        const today = new Date()
        return {
            period_label: "",
            year: today.getFullYear(),
            month_number: today.getMonth() + 1,
            week_number: "",
            start_date: "",
            end_date: "",
        }
    }

    const [form, setForm] = useState(getInitialValues)
    const [brandValues, setBrandValues] = useState<Record<string, string>>(
        () => Object.fromEntries(brands.map(b => [b, ""]))
    )

    const set = (key: string, val: string | number) => setForm(f => ({ ...f, [key]: val }))

    const handleStartDateChange = (val: string) => {
        if (periodType === "week" && val) {
            const d = parseISO(val)
            const weekNum = getISOWeek(d)
            const year = d.getFullYear()
            const monthNum = d.getMonth() + 1
            const endDate = format(addDays(d, 6), 'yyyy-MM-dd')
            setForm(f => ({
                ...f,
                start_date: val,
                week_number: String(weekNum),
                year,
                month_number: monthNum,
                period_label: `S${String(weekNum).padStart(2, '0')} ${year}`,
                end_date: endDate,
            }))
        } else {
            set("start_date", val)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const monthNum = periodType === "week" && form.start_date
            ? parseISO(form.start_date).getMonth() + 1
            : Number(form.month_number)

        startTransition(async () => {
            for (const brand of brands) {
                const val = parseFloat(brandValues[brand])
                if (isNaN(val)) continue
                const result = await upsertBilledDay({
                    period_type: periodType,
                    period_label: form.period_label,
                    brand,
                    billed_days: val,
                    year: Number(form.year),
                    month_number: monthNum,
                    week_number: periodType === "week" && form.week_number ? Number(form.week_number) : null,
                    start_date: form.start_date,
                    end_date: form.end_date,
                })
                if (result.error) { setError(result.error); return }
            }
            onAdded()
        })
    }

    return (
        <tr className="bg-primary/5 border-t-2 border-primary/20">
            <td colSpan={brands.length + 2} className="px-4 py-4">
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
                    {/* Libellé */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Libellé</label>
                        <input
                            required
                            placeholder={periodType === "month" ? "ex: Janvier 2026" : "ex: S01 2026"}
                            value={form.period_label}
                            onChange={(e) => set("period_label", e.target.value)}
                            className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* Année */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Année</label>
                        <input
                            type="number"
                            required
                            value={form.year}
                            onChange={(e) => set("year", e.target.value)}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* Mois — seulement pour les périodes mensuelles */}
                    {periodType === "month" && (
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Mois (n°)</label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                required
                                value={form.month_number}
                                onChange={(e) => set("month_number", e.target.value)}
                                className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                    )}

                    {/* Semaine (n°) — readonly, auto-calculé depuis start_date */}
                    {periodType === "week" && (
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Semaine</label>
                            <input
                                readOnly
                                value={form.week_number ? `S${String(form.week_number).padStart(2, '0')}` : "—"}
                                className="w-16 rounded-md border border-input bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground focus-visible:outline-none"
                            />
                        </div>
                    )}

                    {/* Période — un seul calendrier pour début et fin */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Période</label>
                        <PeriodRangePicker
                            startDate={form.start_date}
                            endDate={form.end_date}
                            onStartChange={handleStartDateChange}
                            onEndChange={(val) => set("end_date", val)}
                            weekMode={periodType === "week"}
                        />
                    </div>

                    {/* Valeurs par marque */}
                    <div className="border-l pl-3 flex gap-3">
                        {brands.map(brand => (
                            <div key={brand} className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{brand}</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="0"
                                    value={brandValues[brand] ?? ""}
                                    onChange={(e) => setBrandValues(v => ({ ...v, [brand]: e.target.value }))}
                                    className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 items-end">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                        >
                            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Ajouter
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                            Annuler
                        </button>
                    </div>

                    {error && <p className="w-full text-xs text-destructive">{error}</p>}
                </form>
            </td>
        </tr>
    )
}

// -------------------------------------------------------------------
// Billed Days Table
// -------------------------------------------------------------------

function BilledDaysTable({
    entries,
    periodType,
    brands,
    readOnly = false,
}: {
    entries: BilledDayEntry[]
    periodType: "week" | "month"
    brands: string[]
    readOnly?: boolean
}) {
    const router = useRouter()
    const { t } = useLanguage()
    const [showAddForm, setShowAddForm] = useState(false)
    const [deletingLabel, setDeletingLabel] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const grouped = groupByPeriod(entries, brands)
    const sorted = sortPeriods(grouped)

    // Last period for pre-filling the add form
    const lastEntry = sorted.length > 0
        ? Object.values(sorted[sorted.length - 1][1]).find(Boolean)
        : undefined

    const handleDelete = (periodLabel: string) => {
        setDeletingLabel(periodLabel)
        startTransition(async () => {
            await deleteBilledPeriod(periodLabel, periodType)
            router.refresh()
            setDeletingLabel(null)
        })
    }

    const refresh = () => {
        router.refresh()
        setShowAddForm(false)
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/40 font-semibold border-b">
                        <tr>
                            <th className="px-4 py-3 text-left w-44">{t("admin.period")}</th>
                            {brands.map(b => (
                                <th key={b} className="px-3 py-3 text-right w-24">{b}</th>
                            ))}
                            {!readOnly && <th className="px-3 py-3 text-right w-20">{t("admin.actions")}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(([label, row]) => {
                            const firstEntry = Object.values(row).find(Boolean)!
                            const isDeleting = isPending && deletingLabel === label
                            return (
                                <tr key={label} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">
                                        <div>{normalizeWeekLabel(label)}</div>
                                        {periodType === "week" && firstEntry.start_date && (
                                            <div className="text-xs text-muted-foreground font-normal font-mono mt-0.5">
                                                {formatWeekDates(firstEntry.start_date, firstEntry.end_date)}
                                            </div>
                                        )}
                                    </td>
                                    {brands.map(brand => (
                                        <BilledCell
                                            key={brand}
                                            entry={row[brand]}
                                            periodLabel={label}
                                            brand={brand}
                                            periodMeta={firstEntry}
                                            onSaved={() => router.refresh()}
                                            readOnly={readOnly}
                                        />
                                    ))}
                                    {!readOnly && (
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() => handleDelete(label)}
                                                disabled={isDeleting}
                                                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                                title={t("admin.period")}
                                            >
                                                {isDeleting
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <Trash2 className="h-3.5 w-3.5" />}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                        {sorted.length === 0 && (
                            <tr>
                                <td colSpan={brands.length + 2} className="px-4 py-8 text-center text-muted-foreground text-sm">
                                    {t("admin.noBilledData")}
                                </td>
                            </tr>
                        )}
                        {showAddForm && (
                            <AddPeriodForm
                                periodType={periodType}
                                brands={brands}
                                onAdded={refresh}
                                onCancel={() => setShowAddForm(false)}
                                lastPeriod={lastEntry}
                            />
                        )}
                    </tbody>
                </table>
            </div>

            {!showAddForm && !readOnly && (
                <div className="px-4 py-3 border-t bg-muted/10">
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Nouvelle période
                    </button>
                </div>
            )}
        </div>
    )
}

// -------------------------------------------------------------------
// Planned Rates Table
// -------------------------------------------------------------------

function groupPlannedByMonth(rates: PlannedRate[], brands: string[]): Map<string, Record<string, PlannedRate | undefined>> {
    const map = new Map<string, Record<string, PlannedRate | undefined>>()
    for (const rate of rates) {
        const key = rate.effective_from.slice(0, 7) // "2026-01"
        if (!map.has(key)) {
            map.set(key, Object.fromEntries(brands.map(b => [b, undefined])))
        }
        const row = map.get(key)!
        row[rate.brand] = rate
    }
    return map
}

// -------------------------------------------------------------------
// Planned Cell — inline edit per brand × month
// -------------------------------------------------------------------

function PlannedCell({
    rate,
    brand,
    effectiveFrom,
    effectiveTo,
    onSaved,
    readOnly = false,
}: {
    rate?: PlannedRate
    brand: string
    effectiveFrom: string
    effectiveTo: string
    onSaved: () => void
    readOnly?: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(rate?.daily_rate?.toString() ?? "")
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
    const [isPending, startTransition] = useTransition()
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editing) inputRef.current?.focus()
    }, [editing])

    useEffect(() => {
        if (!editing) setValue(rate?.daily_rate?.toString() ?? "")
    }, [rate, editing])

    const handleSave = () => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0) {
            setEditing(false)
            setValue(rate?.daily_rate?.toString() ?? "")
            return
        }
        setStatus("saving")
        startTransition(async () => {
            const result = await upsertPlannedRate({
                brand,
                daily_rate: num,
                effective_from: effectiveFrom,
                effective_to: effectiveTo,
            })
            if (result.error) {
                setStatus("error")
            } else {
                setStatus("saved")
                onSaved()
                setTimeout(() => setStatus("idle"), 1500)
            }
            setEditing(false)
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave()
        if (e.key === "Escape") { setEditing(false); setValue(rate?.daily_rate?.toString() ?? "") }
    }

    // Read-only: plain display
    if (readOnly) {
        return (
            <td className="px-3 py-2 text-right">
                <span className={`font-mono text-sm ${rate ? "text-foreground" : "text-muted-foreground/40"}`}>
                    {rate ? rate.daily_rate.toFixed(1) : "—"}
                </span>
            </td>
        )
    }

    if (editing) {
        return (
            <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                    <input
                        ref={inputRef}
                        type="number"
                        step="0.1"
                        min="0"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-20 rounded-md border border-primary bg-background px-2 py-1 text-sm text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
            </td>
        )
    }

    return (
        <td
            className="px-3 py-2 text-right cursor-pointer group"
            onClick={() => {
                setEditing(true)
                setValue(rate?.daily_rate?.toString() ?? "0")
            }}
        >
            <div className="flex items-center justify-end gap-1.5">
                {isPending || status === "saving" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : status === "saved" ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                ) : status === "error" ? (
                    <X className="h-3 w-3 text-destructive" />
                ) : null}
                <span className={`font-mono text-sm ${rate ? "text-foreground" : "text-muted-foreground/40"} group-hover:text-primary transition-colors`}>
                    {rate ? rate.daily_rate.toFixed(1) : "—"}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
            </div>
        </td>
    )
}

// -------------------------------------------------------------------
// Add Planned Month Form
// -------------------------------------------------------------------

function AddPlannedMonthForm({
    brands: brandList,
    onAdded,
    onCancel,
    lastMonthKey,
}: {
    brands: string[]
    onAdded: () => void
    onCancel: () => void
    lastMonthKey?: string // "2026-01"
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const getInitialValues = () => {
        const nextDate = lastMonthKey
            ? addMonths(parseISO(lastMonthKey + "-01"), 1)
            : startOfMonth(new Date())
        return { year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 }
    }

    const init = getInitialValues()
    const [year, setYear] = useState(init.year)
    const [month, setMonth] = useState(init.month)
    const [brands, setBrands] = useState<Record<string, string>>(
        () => Object.fromEntries(brandList.map(b => [b, ""]))
    )

    const safeDate = new Date(year, Math.max(0, Math.min(11, month - 1)), 1)
    const firstDay = format(safeDate, 'yyyy-MM-dd')
    const lastDay = format(endOfMonth(safeDate), 'yyyy-MM-dd')
    const label = format(safeDate, 'MMMM yyyy', { locale: fr }).replace(/^./, c => c.toUpperCase())
    const periodeDisplay = `${format(safeDate, 'dd/MM')} – ${format(endOfMonth(safeDate), 'dd/MM')}`

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        const entries = brandList.map(b => ({ brand: b, val: parseFloat(brands[b]) }))
            .filter(({ val }) => !isNaN(val) && val >= 0)
        if (entries.length === 0) { setError("Saisissez au moins une valeur."); return }
        startTransition(async () => {
            for (const { brand, val } of entries) {
                const result = await upsertPlannedRate({
                    brand,
                    daily_rate: val,
                    effective_from: firstDay,
                    effective_to: lastDay,
                })
                if (result.error) { setError(result.error); return }
            }
            onAdded()
        })
    }

    return (
        <tr className="bg-primary/5 border-t-2 border-primary/20">
            <td colSpan={brandList.length + 2} className="px-4 py-4">
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
                    {/* Libellé */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Libellé</label>
                        <input
                            readOnly
                            value={label}
                            className="w-36 rounded-md border border-input bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground focus-visible:outline-none"
                        />
                    </div>

                    {/* Année */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Année</label>
                        <input
                            type="number"
                            required
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* Mois */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Mois (n°)</label>
                        <input
                            type="number"
                            required
                            min="1"
                            max="12"
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* Période */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Période</label>
                        <input
                            readOnly
                            value={periodeDisplay}
                            className="w-32 rounded-md border border-input bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground font-mono focus-visible:outline-none"
                        />
                    </div>

                    {/* Valeurs par marque */}
                    <div className="border-l pl-3 flex gap-3">
                        {brandList.map(brand => (
                            <div key={brand} className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{brand}</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="0"
                                    value={brands[brand]}
                                    onChange={(e) => setBrands(b => ({ ...b, [brand]: e.target.value }))}
                                    className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 items-end">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                        >
                            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Ajouter
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                            Annuler
                        </button>
                    </div>
                    {error && <p className="w-full text-xs text-destructive">{error}</p>}
                </form>
            </td>
        </tr>
    )
}

function PlannedRatesTable({ rates, brands, readOnly = false }: { rates: PlannedRate[], brands: string[], readOnly?: boolean }) {
    const router = useRouter()
    const { t, locale } = useLanguage()
    const dateFnsLocale = locale === "fr" ? fr : enUS
    const [showAddForm, setShowAddForm] = useState(false)
    const [deletingKey, setDeletingKey] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const grouped = groupPlannedByMonth(rates, brands)
    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
    const lastMonthKey = sorted.length > 0 ? sorted[sorted.length - 1][0] : undefined

    const handleDelete = (monthKey: string, row: Record<string, PlannedRate | undefined>) => {
        const ids = Object.values(row).filter(Boolean).map(r => r!.id)
        if (ids.length === 0) return
        setDeletingKey(monthKey)
        startTransition(async () => {
            for (const id of ids) await deletePlannedRate(id)
            router.refresh()
            setDeletingKey(null)
        })
    }

    const refresh = () => {
        router.refresh()
        setShowAddForm(false)
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/40 font-semibold border-b">
                        <tr>
                            <th className="px-4 py-3 text-left w-44">{t("admin.period")}</th>
                            {brands.map(b => (
                                <th key={b} className="px-3 py-3 text-right w-24">{b}</th>
                            ))}
                            {!readOnly && <th className="px-3 py-3 text-right w-20">{t("admin.actions")}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(([key, row]) => {
                            const isDeleting = isPending && deletingKey === key
                            const firstDay = key + "-01"
                            const lastDay = format(endOfMonth(parseISO(firstDay)), 'yyyy-MM-dd')
                            const monthLabel = format(parseISO(firstDay), 'MMMM yyyy', { locale: dateFnsLocale })
                                .replace(/^./, c => c.toUpperCase())
                            return (
                                <tr key={key} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">
                                        <div>{monthLabel}</div>
                                        <div className="text-xs text-muted-foreground font-normal font-mono mt-0.5">
                                            {format(parseISO(firstDay), 'dd/MM')} – {format(parseISO(lastDay), 'dd/MM')}
                                        </div>
                                    </td>
                                    {brands.map(brand => (
                                        <PlannedCell
                                            key={brand}
                                            rate={row[brand]}
                                            brand={brand}
                                            effectiveFrom={firstDay}
                                            effectiveTo={lastDay}
                                            onSaved={() => router.refresh()}
                                            readOnly={readOnly}
                                        />
                                    ))}
                                    {!readOnly && (
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() => handleDelete(key, row)}
                                                disabled={isDeleting}
                                                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                                title={t("admin.period")}
                                            >
                                                {isDeleting
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <Trash2 className="h-3.5 w-3.5" />}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                        {sorted.length === 0 && (
                            <tr>
                                <td colSpan={brands.length + 2} className="px-4 py-8 text-center text-muted-foreground text-sm">
                                    {t("admin.noData")}
                                </td>
                            </tr>
                        )}
                        {showAddForm && (
                            <AddPlannedMonthForm
                                brands={brands}
                                onAdded={refresh}
                                onCancel={() => setShowAddForm(false)}
                                lastMonthKey={lastMonthKey}
                            />
                        )}
                    </tbody>
                </table>
            </div>
            {!showAddForm && !readOnly && (
                <div className="px-4 py-3 border-t bg-muted/10">
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        {t("admin.newMonth")}
                    </button>
                </div>
            )}
        </div>
    )
}

// -------------------------------------------------------------------
// Main client component
// -------------------------------------------------------------------

export function JHManagementClient({ billedWeeks, billedMonths, plannedRates, brands, readOnly = false, liveMode = false }: Props) {
    const { t } = useLanguage()
    const [view, setView] = useState<"month" | "week">("month")

    const entries = view === "month" ? billedMonths : billedWeeks

    if (brands.length === 0) {
        return (
            <div
                className="px-4 py-3 rounded-md text-sm text-muted-foreground"
                style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}
            >
                {t("admin.noBrands")}
            </div>
        )
    }

    return (
        <div className="space-y-10">
            {readOnly && (
                <div
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm"
                    style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", color: "rgba(0,212,255,0.6)" }}
                >
                    <span className="text-[10px] font-semibold tracking-widest uppercase">{t("admin.readOnlyBadge")}</span>
                    <span className="text-muted-foreground">— {t("admin.demoNote")}</span>
                </div>
            )}
            {liveMode && !readOnly && (
                <div
                    className="px-4 py-2 rounded-md text-sm text-muted-foreground"
                    style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)" }}
                >
                    {t("admin.liveNote")}
                </div>
            )}
            {/* Billed Man-days */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">{t("admin.billedJh")}</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t("admin.billedRef")}
                        </p>
                    </div>
                    {/* Tabs */}
                    <div className="flex items-center gap-1">
                        {(["month", "week"] as const).map(v => {
                            const isActive = view === v
                            return (
                                <button
                                    key={v}
                                    onClick={() => setView(v)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all duration-200 border ${isActive
                                        ? "bg-primary/20 text-neon-cyan font-medium border-neon-cyan/20"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-transparent"
                                    }`}
                                    style={isActive ? {
                                        boxShadow: "0 0 12px rgba(0,212,255,0.08), inset 0 1px 0 rgba(0,212,255,0.1)"
                                    } : undefined}
                                >
                                    {v === "month" ? t("admin.byMonth") : t("admin.byWeek")}
                                </button>
                            )
                        })}
                    </div>
                </div>
                <BilledDaysTable entries={entries} periodType={view} brands={brands} readOnly={readOnly} />
            </section>

            {/* Planned Man-days */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">{t("admin.plannedJh")}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {t("admin.plannedRef")}
                    </p>
                </div>
                <PlannedRatesTable rates={plannedRates} brands={brands} readOnly={readOnly} />
            </section>
        </div>
    )
}

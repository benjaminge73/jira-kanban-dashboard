"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, MessageSquare } from "lucide-react"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import type { BackflowKPIs, GroupedRejectedTicket } from "@/types/kanban"
import { getRejectionComments, type RejectionComment } from "@/lib/actions/kpis"
import { useLanguage } from "@/lib/i18n/context"

interface QualityRejectionsDetailProps {
    data: BackflowKPIs["rejections_detail_by_brand"]
}

export function QualityRejectionsDetail({ data }: QualityRejectionsDetailProps) {
    const { t, locale } = useLanguage()
    const brands = Object.keys(data).filter(b => b !== "Unknown")
    const [activeBrand, setActiveBrand] = useState<string>(brands[0] || "")
    const [openCategory, setOpenCategory] = useState<string | null>(null)

    if (brands.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border rounded-xl bg-card">
                <p>{t("quality.noRejections")}</p>
            </div>
        )
    }

    const activeData = data[activeBrand] || []
    const categories: ("Dev" | "QA" | "Business")[] = ["Dev", "QA", "Business"]

    const toggleCategory = (cat: string) => {
        setOpenCategory(prev => prev === cat ? null : cat)
    }

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col"
            style={{ borderColor: "rgba(0,212,255,0.12)" }}>

            {/* Header */}
            <div className="p-6 border-b border-border/50 bg-muted/20">
                <div className="flex w-full justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold">{t("quality.detailsTitle")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t("quality.detailsDesc")}</p>
                    </div>
                </div>

                <div className="mt-4 bg-background/50 rounded-lg p-3 text-sm text-muted-foreground border border-border/50">
                    <details className="group cursor-pointer">
                        <summary className="font-medium text-foreground flex items-center justify-between outline-none">
                            <span>💡 {t("quality.aboutTable")}</span>
                            <span className="transition group-open:rotate-180">↓</span>
                        </summary>
                        <div className="mt-3 space-y-2 pl-2 border-l-2 border-primary/50 text-sm">
                            <p>{t("quality.aboutBody1")}</p>
                            <p>{t("quality.aboutBody2")}</p>
                        </div>
                    </details>
                </div>
            </div>

            {/* Brand tabs */}
            <div className="flex border-b px-4" style={{ borderColor: "rgba(0,212,255,0.1)" }}>
                {brands.map((brand) => {
                    const isActive = activeBrand === brand
                    return (
                        <button
                            key={brand}
                            onClick={() => {
                                setActiveBrand(brand)
                                setOpenCategory(null)
                            }}
                            className={`px-6 py-3 text-sm font-semibold transition-all duration-200 border-b-2 -mb-[1px] ${
                                isActive
                                    ? "border-[#00d4ff] text-[#00d4ff]"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-white/20"
                            }`}
                            style={isActive ? { textShadow: "0 0 8px rgba(0,212,255,0.4)" } : undefined}
                        >
                            {brand}
                            <span
                                className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                                    isActive
                                        ? "text-[#00d4ff] border border-[#00d4ff]/30"
                                        : "bg-muted text-foreground/60"
                                }`}
                                style={isActive ? { background: "rgba(0,212,255,0.08)" } : undefined}
                            >
                                {data[brand]?.length || 0}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Accordions */}
            <div className="p-4 space-y-3">
                {categories.map((category) => {
                    const tickets = activeData.filter(t => t.rejections.some(r => r.category === category));

                    const uniqueTickets = [...tickets].sort((a, b) => {
                        const aMax = Math.max(...a.rejections.map(r => new Date(r.transition_date).getTime()));
                        const bMax = Math.max(...b.rejections.map(r => new Date(r.transition_date).getTime()));
                        return bMax - aMax;
                    });

                    const isOpen = openCategory === category
                    const isEmpty = tickets.length === 0

                    // Category color accents
                    const catColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
                        Dev:      { bg: "rgba(66,133,244,0.08)",  text: "#4285f4", border: "rgba(66,133,244,0.25)",  icon: "rgba(66,133,244,0.15)" },
                        QA:       { bg: "rgba(0,212,255,0.08)",   text: "#00d4ff", border: "rgba(0,212,255,0.25)",   icon: "rgba(0,212,255,0.15)" },
                        Business: { bg: "rgba(249,115,22,0.08)",  text: "#f97316", border: "rgba(249,115,22,0.25)",  icon: "rgba(249,115,22,0.15)" },
                    }
                    const cc = catColors[category]

                    return (
                        <div
                            key={category}
                            className="rounded-xl overflow-hidden transition-all duration-200"
                            style={{
                                border: isOpen
                                    ? `1px solid ${cc.border}`
                                    : "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            <button
                                onClick={() => !isEmpty && toggleCategory(category)}
                                disabled={isEmpty}
                                className={`flex w-full items-center justify-between p-4 text-left font-medium transition-all duration-200 ${
                                    isEmpty
                                        ? "opacity-40 cursor-not-allowed"
                                        : isOpen
                                            ? "bg-white/5"
                                            : "hover:bg-white/[0.03]"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                                        style={{ background: cc.icon, color: cc.text }}
                                    >
                                        {category.charAt(0)}
                                    </div>
                                    <span className="text-base font-semibold text-foreground">{category}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        className="text-xs font-semibold px-3 py-1 rounded-full"
                                        style={{
                                            background: isEmpty ? "rgba(255,255,255,0.05)" : cc.bg,
                                            color: isEmpty ? "var(--muted-foreground)" : cc.text,
                                            border: `1px solid ${isEmpty ? "rgba(255,255,255,0.08)" : cc.border}`,
                                        }}
                                    >
                                        {tickets.length} {t("quality.tickets")}
                                    </span>
                                    {!isEmpty && (
                                        isOpen
                                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>
                            </button>

                            {isOpen && tickets.length > 0 && (
                                <div className="border-t bg-white/[0.02] p-4" style={{ borderColor: cc.border }}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="text-xs uppercase font-semibold"
                                                    style={{ borderBottom: `1px solid ${cc.border}`, color: cc.text }}>
                                                    <th className="px-4 py-3 rounded-tl-md w-8"></th>
                                                    <th className="px-4 py-3 whitespace-nowrap w-28">{t("quality.ticketKey")}</th>
                                                    <th className="px-4 py-3 whitespace-nowrap w-40">{t("quality.rejectionDate")}</th>
                                                    <th className="px-4 py-3 w-full min-w-[200px]">{t("quality.summary")}</th>
                                                    <th className="px-4 py-3 whitespace-nowrap w-36">{t("quality.previousStatus")}</th>
                                                    <th className="px-4 py-3 whitespace-nowrap w-36">{t("quality.targetStatus")}</th>
                                                    <th className="px-4 py-3 whitespace-nowrap w-36 rounded-tr-md">{t("quality.currentStatus")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uniqueTickets.map((ticket, i) => (
                                                    <QualityRejectionRow
                                                        key={`${ticket.issue_key}-${i}`}
                                                        ticket={ticket}
                                                        accentColor={cc.text}
                                                        accentBg={cc.bg}
                                                        accentBorder={cc.border}
                                                        locale={locale}
                                                        t={t}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function QualityRejectionRow({
    ticket,
    accentColor,
    accentBg,
    accentBorder,
    locale,
    t,
}: {
    ticket: GroupedRejectedTicket
    accentColor: string
    accentBg: string
    accentBorder: string
    locale: string
    t: (key: any) => string
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [commentsByDate, setCommentsByDate] = useState<Record<string, RejectionComment[]>>({})

    const dateFnsLocale = locale === "fr" ? fr : undefined

    const toggleExpand = async () => {
        const nextExpanded = !isExpanded
        setIsExpanded(nextExpanded)

        if (nextExpanded && Object.keys(commentsByDate).length === 0) {
            setIsLoading(true)
            try {
                const newComments: Record<string, RejectionComment[]> = {};
                for (const rej of ticket.rejections) {
                    const fetched = await getRejectionComments(ticket.issue_key, rej.transition_date)
                    newComments[rej.transition_date] = fetched;
                }
                setCommentsByDate(newComments)
            } catch (err) {
                console.error("Failed to fetch comments", err)
            } finally {
                setIsLoading(false)
            }
        }
    }

    const latestDateStr = ticket.rejections.reduce((latest, current) => {
        return new Date(current.transition_date).getTime() > new Date(latest).getTime() ? current.transition_date : latest;
    }, ticket.rejections[0].transition_date);

    const formattedDate = latestDateStr
        ? format(parseISO(latestDateStr), locale === "fr" ? "dd MMM yyyy 'à' HH:mm" : "MMM dd, yyyy HH:mm", { locale: dateFnsLocale })
        : "—"

    const isMultiple = ticket.rejections.length > 1;

    return (
        <>
            <tr
                className={`border-b last:border-0 cursor-pointer transition-all duration-150 ${
                    isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
                }`}
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
                onClick={toggleExpand}
            >
                <td className="px-4 py-3 text-muted-foreground w-8">
                    {isExpanded
                        ? <ChevronDown className="h-4 w-4" style={{ color: accentColor }} />
                        : <ChevronRight className="h-4 w-4" />
                    }
                </td>
                <td className="px-4 py-3 whitespace-nowrap w-28">
                    <span className="font-mono font-bold text-foreground">{ticket.issue_key}</span>
                    {isMultiple && (
                        <span
                            className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{ background: accentBg, color: accentColor, border: `1px solid ${accentBorder}` }}
                        >
                            {ticket.rejections.length}×
                        </span>
                    )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground/70 text-xs w-40">
                    {isMultiple ? `${t("quality.latest")}${formattedDate}` : formattedDate}
                </td>
                <td className="px-4 py-3 w-full max-w-[200px] truncate text-foreground/80" title={ticket.summary}>
                    {ticket.summary}
                </td>
                <td className="px-4 py-3 whitespace-nowrap w-36">
                    <span
                        className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                        {isMultiple ? t("quality.multiple") : ticket.rejections[0].from_status}
                    </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap w-36">
                    <span
                        className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: "rgba(249,115,22,0.08)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" }}
                    >
                        {isMultiple ? t("quality.multiple") : ticket.rejections[0].status}
                    </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap w-36">
                    <span
                        className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted-foreground)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                        {ticket.current_status}
                    </span>
                </td>
            </tr>
            {isExpanded && (
                <tr style={{ background: "rgba(0,212,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td></td>
                    <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-col space-y-6">
                            {ticket.rejections.map((rej, index) => {
                                const dStr = format(
                                    parseISO(rej.transition_date),
                                    locale === "fr" ? "dd MMM yyyy 'à' HH:mm" : "MMM dd, yyyy HH:mm",
                                    { locale: dateFnsLocale }
                                );
                                const comments = commentsByDate[rej.transition_date];

                                return (
                                    <div key={index} className="flex flex-col space-y-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                <span style={{ color: accentColor }}>
                                                    {t("quality.rejectedOn")} {dStr}
                                                </span>
                                            </h4>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                (<span className="line-through opacity-60">{rej.from_status}</span>
                                                <span className="mx-0.5">→</span>
                                                {rej.status}
                                                <span className="mx-1">·</span>
                                                <span className="font-semibold text-foreground">{rej.category}</span>)
                                            </span>
                                        </div>

                                        {isLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t("quality.loadingComments")}
                                            </div>
                                        ) : !comments ? (
                                            null
                                        ) : comments.length === 0 ? (
                                            <p className="text-sm text-muted-foreground/60 italic py-2">
                                                {t("quality.noComments")}
                                            </p>
                                        ) : (
                                            <div className="space-y-3 pl-6 border-l-2" style={{ borderColor: accentBorder }}>
                                                {comments.map((comment, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="bg-background/60 border rounded-lg p-3 text-sm flex flex-col gap-1.5 shadow-sm"
                                                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold" style={{ color: accentColor }}>
                                                                {comment.author}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground/60">
                                                                {format(
                                                                    parseISO(comment.created),
                                                                    locale === "fr" ? "dd MMM yyyy HH:mm" : "MMM dd, yyyy HH:mm",
                                                                    { locale: dateFnsLocale }
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="whitespace-pre-wrap text-foreground/80 text-sm leading-relaxed">
                                                            {comment.body}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}

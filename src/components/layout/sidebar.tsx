"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TrendingUp, CheckCircle, Euro, Menu, ShieldCheck } from "lucide-react"
import { Suspense, useState } from "react"
import { DateRangeSidebar } from "@/components/layout/date-range-sidebar"
import { useLanguage } from "@/lib/i18n/context"
import type { AppMode, CalendarBounds } from "@/lib/data-source/types"

interface SidebarProps {
    mode: AppMode
    showBudgetTab: boolean
    calendarBounds: CalendarBounds | null
}

export function Sidebar({ mode, showBudgetTab, calendarBounds }: SidebarProps) {
    const pathname = usePathname()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const { locale, setLocale, t } = useLanguage()

    const navItems = [
        { icon: TrendingUp, label: t("nav.flow"), href: "/dashboard" },
        { icon: CheckCircle, label: t("nav.quality"), href: "/quality" },
        ...(showBudgetTab ? [{ icon: Euro, label: t("nav.budget"), href: "/budget" }] : []),
    ]

    const utilItems = [
        { icon: ShieldCheck, label: t("nav.admin"), href: "/admin" },
    ]

    return (
        <aside
            className={`flex h-screen flex-col py-4 font-sans bg-card border-r border-border transition-all duration-300 ${isCollapsed ? "w-16 px-1" : "w-72 px-4"}`}
            style={{ boxShadow: "4px 0 24px rgba(0,0,0,0.4), 1px 0 0 rgba(0,212,255,0.06)" }}
        >
            {/* Header */}
            <div className={`flex items-start mb-8 ${isCollapsed ? "justify-center flex-col items-center gap-4" : "justify-between px-2"}`}>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-neon-cyan hover:bg-white/5 transition-all duration-200 shrink-0 my-auto"
                    title={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
                >
                    <Menu className="h-4 w-4" />
                </button>
                {!isCollapsed && (
                    <div className="overflow-hidden mr-2">
                        <h2 className="text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
                            Kanban{" "}
                            <span
                                className="text-neon-cyan"
                                style={{ textShadow: "0 0 12px rgba(0,212,255,0.6), 0 0 24px rgba(0,212,255,0.3)" }}
                            >
                                mAIster
                            </span>
                        </h2>
                        <p className="text-[10px] text-muted-foreground/70 whitespace-nowrap tracking-widest uppercase">
                            {mode === "live" ? "Live Dashboard" : "Demo Dashboard"}
                        </p>
                    </div>
                )}
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto pb-4">
                {!isCollapsed && (
                    <p className="px-3 mb-2 text-[9px] font-semibold tracking-widest uppercase text-muted-foreground/50">
                        {t("nav.navigation")}
                    </p>
                )}

                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={`flex items-center gap-3 rounded-md py-2 text-sm transition-all duration-200 border ${isCollapsed ? "justify-center px-0 mx-1" : "px-3"} ${isActive
                                ? "bg-primary/20 text-neon-cyan font-medium border-neon-cyan/20"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-transparent"
                                }`}
                            style={isActive ? { boxShadow: "0 0 12px rgba(0,212,255,0.08), inset 0 1px 0 rgba(0,212,255,0.1)" } : undefined}
                        >
                            <item.icon
                                className={`h-4 w-4 shrink-0 ${isActive ? "text-neon-cyan" : ""}`}
                                style={isActive ? { filter: "drop-shadow(0 0 4px rgba(0,212,255,0.6))" } : undefined}
                            />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                        </Link>
                    )
                })}

                {!isCollapsed && (
                    <div className="pt-3 pb-1 -mx-1">
                        <Suspense fallback={<div className="h-20 animate-pulse bg-white/5 rounded-md mx-2" />}>
                            <DateRangeSidebar calendarBounds={calendarBounds} />
                        </Suspense>
                    </div>
                )}

                {/* Neon divider */}
                <div
                    className="my-3 mx-2"
                    style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)" }}
                />

                {!isCollapsed && (
                    <p className="px-3 mb-1 text-[9px] font-semibold tracking-widest uppercase text-muted-foreground/50">
                        {t("nav.admin")}
                    </p>
                )}
                {utilItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={`flex items-center gap-3 rounded-md py-2 text-sm transition-all duration-200 border ${isCollapsed ? "justify-center px-0 mx-1" : "px-3"} ${isActive
                                ? "bg-primary/20 text-neon-cyan font-medium border-neon-cyan/20"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-transparent"
                                }`}
                        >
                            <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-neon-cyan" : ""}`} />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                        </Link>
                    )
                })}
            </nav>

            {/* Language toggle + footer */}
            {!isCollapsed ? (
                <div className="mt-auto px-3 py-3 border-t border-border/50 space-y-2">
                    {/* Language switcher */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setLocale("en")}
                            className={`flex-1 text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded transition-all duration-200 ${locale === "en"
                                ? "text-neon-cyan border border-neon-cyan/30"
                                : "text-muted-foreground/50 border border-transparent hover:border-white/10 hover:text-muted-foreground"
                                }`}
                            style={locale === "en" ? { background: "rgba(0,212,255,0.08)" } : undefined}
                        >
                            EN
                        </button>
                        <span className="text-muted-foreground/20 text-xs">|</span>
                        <button
                            onClick={() => setLocale("fr")}
                            className={`flex-1 text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded transition-all duration-200 ${locale === "fr"
                                ? "text-neon-cyan border border-neon-cyan/30"
                                : "text-muted-foreground/50 border border-transparent hover:border-white/10 hover:text-muted-foreground"
                                }`}
                            style={locale === "fr" ? { background: "rgba(0,212,255,0.08)" } : undefined}
                        >
                            FR
                        </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground/40 whitespace-nowrap tracking-wider uppercase">V2 · Next.js Edition</p>
                    <p className="text-[9px] text-muted-foreground/30 whitespace-nowrap">Benjamin Goalabre © 2026</p>
                    <span
                        className="inline-block text-[8px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded mt-1"
                        style={{ background: "rgba(0,212,255,0.08)", color: "rgba(0,212,255,0.5)", border: "1px solid rgba(0,212,255,0.15)" }}
                    >
                        {t(mode === "live" ? "sidebar.liveMode" : "sidebar.demoMode")}
                    </span>
                </div>
            ) : (
                <div className="mt-auto border-t border-border/50 py-3 flex flex-col items-center gap-2">
                    {/* Compact language toggle */}
                    <button
                        onClick={() => setLocale(locale === "en" ? "fr" : "en")}
                        className="text-[9px] font-bold tracking-wider text-neon-cyan/60 hover:text-neon-cyan transition-colors"
                        title={locale === "en" ? "Switch to French" : "Switch to English"}
                        style={{ textShadow: "0 0 8px rgba(0,212,255,0.3)" }}
                    >
                        {locale.toUpperCase()}
                    </button>
                    <span className="text-xs font-bold text-neon-cyan/60 tracking-widest" style={{ textShadow: "0 0 8px rgba(0,212,255,0.4)" }}>
                        KM
                    </span>
                </div>
            )}
        </aside>
    )
}

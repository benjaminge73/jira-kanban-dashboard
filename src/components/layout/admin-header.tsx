"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PenLine, ShieldCheck } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import type { AppMode } from "@/lib/data-source/types"

export function AdminHeader({ mode }: { mode: AppMode }) {
    const pathname = usePathname()
    const { t } = useLanguage()

    const adminTabs = [
        { labelKey: "admin.tabJh" as const, href: "/admin/jh", icon: PenLine },
    ]

    return (
        <div className="border-b bg-card px-8 pt-6 pb-0 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    <h1 className="text-2xl font-bold tracking-tight">{t("admin.administration")}</h1>
                </div>
                <span
                    className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded"
                    style={{ background: "rgba(0,212,255,0.08)", color: "rgba(0,212,255,0.6)", border: "1px solid rgba(0,212,255,0.2)" }}
                >
                    {t(mode === "live" ? "admin.liveBadge" : "admin.demoBadge")}
                </span>
            </div>

            <nav className="flex gap-1 pb-4">
                {adminTabs.map((tab) => {
                    const isActive = pathname.startsWith(tab.href)
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all duration-200 border ${
                                isActive
                                    ? "bg-primary/20 text-neon-cyan font-medium border-neon-cyan/20"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-transparent"
                            }`}
                            style={isActive ? {
                                boxShadow: "0 0 12px rgba(0,212,255,0.08), inset 0 1px 0 rgba(0,212,255,0.1)"
                            } : undefined}
                        >
                            <tab.icon className="h-4 w-4" />
                            {t(tab.labelKey)}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { setShowBudgetTab } from "@/lib/actions/settings"
import { useLanguage } from "@/lib/i18n/context"

interface Props {
    showBudgetTab: boolean
    readOnly?: boolean
}

export function AdminSettingsClient({ showBudgetTab, readOnly = false }: Props) {
    const { t } = useLanguage()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const handleToggle = () => {
        if (readOnly || isPending) return
        setError(null)
        startTransition(async () => {
            const result = await setShowBudgetTab(!showBudgetTab)
            if (result.error) {
                setError(result.error)
            } else {
                router.refresh()
            }
        })
    }

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold">{t("admin.displaySettings")}</h2>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-foreground">{t("admin.showBudgetTab")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {readOnly ? t("admin.demoNote") : t("admin.showBudgetTabDesc")}
                    </p>
                    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={showBudgetTab}
                    onClick={handleToggle}
                    disabled={readOnly || isPending}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        showBudgetTab ? "bg-primary/60" : "bg-muted"
                    }`}
                    style={showBudgetTab ? { boxShadow: "0 0 8px rgba(0,212,255,0.3)" } : undefined}
                >
                    {isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mx-auto text-foreground" />
                    ) : (
                        <span
                            className={`inline-block h-4 w-4 rounded-full bg-foreground transition-transform ${
                                showBudgetTab ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                    )}
                </button>
            </div>
        </section>
    )
}

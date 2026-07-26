"use client"

import { AlertTriangle } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

/** Shown when some (but not all) JIRA_* variables are set: the app silently
 *  runs on demo data, which must not be mistaken for the real project. */
export function ConfigWarningBanner({ missing }: { missing: string[] }) {
    const { t } = useLanguage()

    return (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-8 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {t("config.partialTitle")}
                </span>{" "}
                <span className="text-muted-foreground">
                    {t("config.partialBody", { vars: missing.join(", ") })}
                </span>
            </div>
        </div>
    )
}

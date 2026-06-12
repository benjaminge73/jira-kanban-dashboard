"use client"

import { useLanguage } from "@/lib/i18n/context"
import type { TranslationKey } from "@/lib/i18n/translations"

interface PageHeaderProps {
    titleKey: TranslationKey
    subtitleKey?: TranslationKey
    className?: string
}

export function PageHeader({ titleKey, subtitleKey, className = "" }: PageHeaderProps) {
    const { t } = useLanguage()
    return (
        <div className={className}>
            <h1 className="text-3xl font-bold tracking-tight">{t(titleKey)}</h1>
            {subtitleKey && (
                <p className="text-muted-foreground mt-2">{t(subtitleKey)}</p>
            )}
        </div>
    )
}

interface SectionHeaderProps {
    titleKey: TranslationKey
    subtitleKey?: TranslationKey
    badge?: React.ReactNode
    className?: string
}

export function SectionHeader({ titleKey, subtitleKey, badge, className = "" }: SectionHeaderProps) {
    const { t } = useLanguage()
    return (
        <div className={`flex w-full justify-between items-start ${className}`}>
            <div>
                <h3 className="text-xl font-bold">{t(titleKey)}</h3>
                {subtitleKey && (
                    <p className="text-sm text-muted-foreground mt-1">{t(subtitleKey)}</p>
                )}
            </div>
            {badge}
        </div>
    )
}

export function TranslatedText({ k, className }: { k: TranslationKey; className?: string }) {
    const { t } = useLanguage()
    return <span className={className}>{t(k)}</span>
}

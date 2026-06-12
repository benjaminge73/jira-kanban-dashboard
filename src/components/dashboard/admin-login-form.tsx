"use client"

import { useState, useTransition } from "react"
import { Lock } from "lucide-react"
import { loginAdmin } from "@/lib/actions/auth"
import { useLanguage } from "@/lib/i18n/context"

export function AdminLoginForm() {
    const { t } = useLanguage()
    const [password, setPassword] = useState("")
    const [error, setError] = useState(false)
    const [isPending, startTransition] = useTransition()

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(false)
        startTransition(async () => {
            const result = await loginAdmin(password)
            if (result?.error) setError(true)
        })
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-bold tracking-tight">{t("admin.loginTitle")}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{t("admin.loginSubtitle")}</p>

            <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("admin.passwordPlaceholder")}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />

            {error && <p className="text-sm text-red-500">{t("admin.invalidPassword")}</p>}

            <button
                type="submit"
                disabled={isPending || password.length === 0}
                className="w-full rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
            >
                {t("admin.signIn")}
            </button>
        </form>
    )
}
